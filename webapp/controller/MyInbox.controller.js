sap.ui.define([
  "./BaseController",
  "sap/ui/model/json/JSONModel",
  "../utils/validation",
  "../model/formatter",
  'sap/ui/export/Spreadsheet',
  "sap/suite/ui/commons/Timeline", // Import Timeline for displaying comments
  "sap/suite/ui/commons/TimelineItem", //Import TimelineItem for individual comments
  "sap/m/MessageToast",
], (BaseController, JSONModel, utils, Formatter, Spreadsheet, Timeline, TimelineItem, MessageToast) => {
  "use strict";

  return BaseController.extend("sap.kt.com.minihrsolution.controller.MyInbox", {
    Formatter: Formatter,

    onInit() {
      this.getRouter().getRoute("RouteMyInbox").attachMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: async function (OEvent) {
      var LoginFUnction = await this.commonLoginFunction("MyInbox");
      if (!LoginFUnction) return;
      this.initializeBirthdayCarousel();
      const oView = this.getView();
      ["MI_id_ButReSend", "MI_id_ButApprove", "MI_id_ButReject", "MI_id_ButPaid"].forEach(id => {
        oView.byId(id).setVisible(false);
      });
      this.getView().getModel("PaySlip").setProperty("/isRouteLOP", false);
      const sParams = OEvent.getParameter("arguments").sMyInBox;
      const oLoginModel = oView.getModel("LoginModel");
      const oLoginData = oLoginModel.getData();
      this.oLoginModel = oLoginData;
      const oComponent = this.getOwnerComponent();
      this._isAccountant = ["Account Manager", "Account Consultant"].includes(oLoginData.Role);
      this.getBusyDialog();
      this.sParams = sParams;
      oView.setModel(new JSONModel([{ type: "Leave" }, { type: "Expense" }, { type: "Resignation" }, { type: "Overtime" }, { type: "Allowance" }]), "oTypeModel");
      this.i18nModel = oView.getModel("i18n").getResourceBundle();
      oLoginModel.setProperty("/HeaderName", this.i18nModel.getText("inboxDetails"));
      this.idEmp = oLoginData.EmployeeID;

      const statusFilter = this._isAccountant ? "Send to account" : "Submitted";
      const filter = this._isAccountant ? { Status: statusFilter } : { ManagerID: this.idEmp, Status: statusFilter };

      if (sParams === "MyInboxView") {
        this.MI_onClearEmployeeDetails();
        this.byId("MI_id_StatusFilter").setValue(statusFilter);
        await this._fetchCommonData("InboxDetails", "MyInboxModelData", filter);
      } else {
        this.MI_onSearch();
      }

      oView.byId("MI_id_LOPDetBut").setVisible(this._isAccountant);
      if (this._isAccountant) {
        oComponent.getModel("MyInbox").setData([
          { ID: 1, StatusName: "Send to account" },
          { ID: 2, StatusName: "Paid" },
          { ID: 3, StatusName: "Submitted" },
        ]);
      }

      const response = await this.ajaxReadWithJQuery("InboxDetails", this._isAccountant ? "" : { ManagerID: this.idEmp });
      this.closeBusyDialog();
      if (response.data?.length) {
        const empData = [...new Map(response.data.filter(item => item.EmpID?.trim()).map(item => [item.EmpID.trim(), item])).values()];
        oView.setModel(new JSONModel(empData), "oModelEmp");
      }
      if (this._isAccountant) { this.commonFilterFunction("MI_id_EmpIDFilter"); }
    },
    MI_onPressLOPData: function () {
      //const oData = this.byId("MI_id_MyInboxTable").getSelectedItem().getBindingContext("MyInboxModelData").getObject();
      this.getRouter().navTo("RouteLOPDetails");
    },
    onPressback() {
      this.getRouter().navTo("RouteTilePage");
      if (this.oDiaReg) {
        this.oDiaReg.close();
        this.oDiaReg.destroy();
        this.oDiaReg = null;
      }
    },

    onLogout() {
      this.getRouter().navTo("RouteLoginPage");
    },

    MI_onPressButtons(oEvent) {
      const actionText = oEvent.getSource().getText();
      const i18n = this.getView().getModel("i18n").getResourceBundle();

      const dialogTexts = {
        "Approve": "confirmApprove",
        "Reject": "confirmRejectleave",
        "Send Back": "confirmReSend",
        "Paid": "confirmPaid"
      };

      this.getText = actionText;
      this.functionToOpenDialog(actionText, i18n.getText(dialogTexts[actionText]));
    },

    MI_onSearch: async function () {
      try {
        this.getBusyDialog();
        const filterItems = this.byId("MI_id_FilterBar").getFilterGroupItems();
        var params = {};
        const oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "yyyy-MM-dd" });

        filterItems.forEach(oItem => {
          const oControl = oItem.getControl();
          const sKey = oItem.getName();

          if (oControl && typeof oControl.getValue === "function") {
            const sValue = oControl.getValue().trim();

            if (sKey === "SubmittedDate" && sValue) {
              const [startDate, endDate] = sValue.split('-').map(date => new Date(date));
              params["SubStartDate"] = oDateFormat.format(startDate);
              params["SubEndDate"] = oDateFormat.format(endDate);
            } else if (sKey === "Type" && oControl.getSelectedKeys().length > 0) {
              params[sKey] = oControl.getSelectedKeys()[0];
            } else if (sValue) {
              params[sKey] = sValue;
            }
          }
        });

        if (!this._isAccountant) params["ManagerID"] = this.idEmp;
        else {
          var status = !params.hasOwnProperty("Status");
          if (!status && params.Status === "Submitted") {
            params["ManagerID"] = this.idEmp;
          }
        }
        await this._fetchCommonData("InboxDetails", "MyInboxModelData", params);
        this.closeBusyDialog();
        if (status && this._isAccountant) {
          this.commonFilterFunction("MI_id_MyInboxTable");
        }
        this.onBeforeShow();
      } catch (error) {
        this.closeBusyDialog();
        sap.m.MessageToast.show(this.i18nModel.getText("commonErrorMessage"));
      }
    },
    commonFilterFunction(ID) {
      // OR group: Status = 'Paid' OR Status = 'Send to account'
      var oPaidOrSendFilter = new sap.ui.model.Filter({
        filters: [
          new sap.ui.model.Filter("Status", sap.ui.model.FilterOperator.EQ, "Paid"),
          new sap.ui.model.Filter("Status", sap.ui.model.FilterOperator.EQ, "Send to account")
        ],
        and: false // OR logic
      });

      // AND group: Status = 'Submitted' AND ManagerID = this.idEmp
      var oSubmittedAndManagerFilter = new sap.ui.model.Filter({
        filters: [
          new sap.ui.model.Filter("Status", sap.ui.model.FilterOperator.EQ, "Submitted"),
          new sap.ui.model.Filter("ManagerID", sap.ui.model.FilterOperator.EQ, this.idEmp)
        ],
        and: true // AND logic
      });

      // Final OR: (Paid OR Send) OR (Submitted AND Manager)
      var finalFilter = new sap.ui.model.Filter({
        filters: [oPaidOrSendFilter, oSubmittedAndManagerFilter],
        and: false // final OR logic
      });


      var oCombinedFilter = new sap.ui.model.Filter(finalFilter, false); // 'false' means OR logic
      var oTable = this.byId(ID);
      oTable.getBinding("items").filter(oCombinedFilter);
    },
    MI_onClearEmployeeDetails() {
      ["EmpID", "Type", "SubmittedDate", "Status"].forEach(id =>
        this.byId(`MI_id_${id}Filter`).setValue("")
      );
      this.byId("MI_id_TypeFilter").removeAllSelectedItems();
    },

    functionToOpenDialog(text, oDialogTitle) {
      const oView = this.getView();
      if (!this.oDialog) {
        sap.ui.core.Fragment.load({
          name: "sap.kt.com.minihrsolution.fragment.ManagerRemarks",
          controller: this
        }).then(oDialog => {
          this.oDialog = oDialog;
          oView.addDependent(oDialog);
          oDialog.open();
          this.valueSetFunction(text, oDialogTitle);
        });
      } else {
        this.oDialog.open();
        this.valueSetFunction(text, oDialogTitle);
      }
    },

    MIF_onPressClose() {
      this.oDialog.close();
      this.onBeforeShow();
    },

    valueSetFunction(text, oDialogTitle) {
      sap.ui.getCore().byId("MIF_id_OkBtn").setText(text);
      const i18n = this.getView().getModel("i18n").getResourceBundle();
      var oValue = this._isAccountant && this.oModelData.Status !== "Submitted" ? i18n.getText("accountRemarksLeave") : i18n.getText("managerRemarksLeave");
      sap.ui.getCore().byId("MIF_id_RemarkLabel").setText(oValue);
      sap.ui.getCore().byId("MIF_id_remark").setValue("");
      sap.ui.getCore().byId("MIF_id_DialogManRemark").setTitle(oDialogTitle);
      sap.ui.getCore().byId("MIF_id_remark").setValueState("None");
    },

    onSelectionChangeStatus() {
      this.oModelData = this.byId("MI_id_MyInboxTable").getSelectedItem().getBindingContext("MyInboxModelData").getObject();
      const { Status, Type } = this.oModelData;
      const isSubmitted = Status === "Submitted";
      const isExpense = Type === "Expense";
      const isAllowance = Type === "Allowance";

      this.byId("MI_id_ButApprove").setVisible(isSubmitted)
      this.byId("MI_id_ButReject").setVisible(isSubmitted)
      this.byId("MI_id_ButReSend").setVisible(((isExpense || isAllowance) && isSubmitted) || (this._isAccountant && Status === "Send to account"));
      this.byId("MI_id_ButPaid").setVisible(this._isAccountant && Status === "Send to account");
    },

    MI_onPressColNavigation: async function (oEvent) {
             const oData = oEvent.getSource().getBindingContext("MyInboxModelData").getObject();
              //  Allowed case
               if (
                   oData.ResourcePlanningType === "Resource Planning" &&
                   oData.Status === "Approved"
               ) {
                   this.getRouter().navTo("RouteDetailLeave", { sLeaveID: oData.ID });
                   return;
               }

              //  Block conditions
               if (
                   oData.ResourcePlanningType === "Resource Planning" ||
                   (oData.Type === "Overtime" && oData.Status === "Submitted")
               ) {
                   return sap.m.MessageToast.show(
                       "This request is not allowed for navigation."
                   );
               }

      if (oData.Type === "Expense") {
        this.getRouter().navTo("RouteExpensDetails", {
          sPath: oData.ID + "|MyInbox"
        });
      } else if (oData.Type === "Leave") {
        this.getOwnerComponent().setModel(new sap.ui.model.json.JSONModel({ from: "MyInbox" }), "NavSource");
        this.getRouter().navTo("RouteDetailLeave", { sLeaveID: oData.ID });
      } else if (oData.Type === "Allowance") {
        this.getRouter().navTo("RouteAllowanceDetails", {
          sPath: oData.ID + "|MyInbox"
        });
      }
      else if (oData.Type === "Resignation") {
        this.getBusyDialog();
        await this._fetchCommonData("EmployeeDetails", "sEmployeeModel", { EmployeeID: oData.EmpID });
        const oView = this.getView();
        if (!this.oDiaReg) {
          sap.ui.core.Fragment.load({
            name: "sap.kt.com.minihrsolution.fragment.Resignation",
            controller: this
          }).then(oDiaReg => {
            this.oDiaReg = oDiaReg;
            oView.addDependent(oDiaReg);
            oDiaReg.open();
            this.functionToOpenResignationDialog(oData);
          });
        } else {
          this.oDiaReg.open();
          this.functionToOpenResignationDialog(oData);
        }
      }
    },
    functionToOpenResignationDialog: function (oModel) {
      var oEmpModel = this.getView().getModel("sEmployeeModel");
      var oData = oEmpModel.getData()[0];
      var empName = oData.Salutation + " " + oData.EmployeeName;
      var joinDate = Formatter.formatDate(oData.JoiningDate);
      var startDate = Formatter.formatDate(oModel.StartDate);
      var endDate = Formatter.formatDate(oModel.EndDate);
      if (oModel.Status === "Rejected") {
        oEmpModel.setProperty("/0/ResignationStartDate", oModel.StartDate);
        oEmpModel.setProperty("/0/ResignationEndDate", oModel.EndDate);
        oEmpModel.setProperty("/0/ResignComment", oModel.EmpComment);
      }
      this.companyName = "Kvriksha Technologies Private Limited";
                var data = `
                <div style="text-align: justify;">
                    <p>Dear <b>${oData.ManagerName}</b>,</p>  
                    <p>I hope this message finds you well.</p>
                    <p>I <b>${empName}</b> writing to formally resign from my position as <b>${oData.Designation}</b> at <b>${this.companyName}</b>, effective <b>${startDate}</b>. My last working day will be <b>${endDate}</b>.</p>
                    <p>I joined this organization on <b>${joinDate}</b>, and it has been an incredibly rewarding journey filled with learning, professional growth, and meaningful relationships. I want to sincerely thank you for your guidance and support throughout my tenure.</p>
                    <p>The reason of resignation is as follows:</p>
                    <p>${oModel.EmpComment}</p>                   
         <p>I will do my best during this transition period to ensure a smooth handover of my responsibilities. Please let me know how I can help during this time.</p>
        <p>Thanks & Best Regards,<br/>
        ${empName}<br/>
        ${oData.Designation}<br/>
        ${this.companyName}</p>
    </div>`;
      this.closeBusyDialog();
      this.getView().setModel(new JSONModel({ "RTEText": data }), "PDFData");
      this.getView().setModel(new JSONModel({ "CanWithdrawResignation": false, "editableResignatin": false, "BtnVisible": false }), "viewModel");
    },
    RF_onPressCloseDialog: function () {
      if (this.oDiaReg) {
        this.oDiaReg.destroy();
        this.oDiaReg = null;
      }
    },
    MTF_onPressOk() {
      const btnText = sap.ui.getCore().byId("MIF_id_OkBtn").getText();
      const i18n = this.getView().getModel("i18n").getResourceBundle();

      const mapStatus = {
        "Approve": this.oModelData.Type === "Expense" ? "Send to account" : "Approved",
        "Reject": "Rejected",
        "Send Back": this._isAccountant && this.oModelData.Status !== "Submitted" ? "Send back by account" : "Send back by manager",
        "Paid": "Paid"
      };

      const successKey = {
        "Approve": "approveMessageSuccess",
        "Reject": "rejectMessageSuccess",
        "Send Back": this.oModelData.Type === "Allowance" ? "resendMessageSuccessAllowance" : "resendMessageSuccess",
        "Paid": "PaidMessageSuccess"
      };

      const errorKey = {
        "Approve": "erroApproveMessage",
        "Reject": "errorRejectMessage",
        "Send Back": this.oModelData.Type === "Allowance" ? "errorResendMessageAllowance" : "errorResendMessage",
        "Paid": "errorPaidMessage"
      };

      if (this.MIF_liveChangeForMangerComments() && sap.ui.getCore().byId("MIF_id_remark").getValue().trim() !== "") {
        const statusValue = mapStatus[btnText];
        sap.ui.getCore().byId("MIF_id_remark").setValueState("None");
        sap.ui.getCore().byId("MIF_id_remark").setValueStateText("");
        this.updateCallForMyInboxFunction(this.oModelData, statusValue, successKey[btnText], errorKey[btnText]);
      } else {
        sap.m.MessageToast.show(i18n.getText("enterComments"));
        sap.ui.getCore().byId("MIF_id_remark").setValueState("Error");
        sap.ui.getCore().byId("MIF_id_remark").setValueStateText(this.getView().getModel('i18n').getResourceBundle().getText("commentsValueState"));
      }
      if(this.oModelData.ResourcePlanningType === 'Resource Planning') this.CreateLeave();
    },

    CreateLeave: function () {
      var oData = {
        ID:this.oModelData.ID,
        employeeID:this.oModelData.EmpID,
        employeeName:this.oModelData.EmpName,
        fromDate:this.oModelData.StartDate,
        toDate:this.oModelData.EndDate,
        NoofDays:this.oModelData.NoofDays,
        typeOfLeave:this.oModelData.SubType,
        status:this.oModelData.Status,
        halfDay:this.oModelData.HalfDay,
        email:this.oModelData.EmpEmailID,
        leaveSessionType:this.oModelData.leaveSessionType,
        type:"Resource Planning",
      }
      this.getBusyDialog(); 
      this.ajaxCreateWithJQuery("Leaves", { data: oData }).then(response => {
        this.closeBusyDialog(); 
      }).catch((error) => {
        this.closeBusyDialog(); //  Close BusyDialog
        MessageToast.show(error.message || error.responseText);
      });
    },
    MIF_liveChangeForMangerComments() {
      const input = sap.ui.getCore().byId("MIF_id_remark");
      if (!input.getValue()) {
        input.setValueStateText(this.getView().getModel('i18n').getResourceBundle().getText("commentsValueState"));
        input.setValueState("Error");
        return false;
      }
      input.setValueState("None");
      return true;
    },

    updateCallForMyInboxFunction(oModelData, statusValue, successMsg, errorMsg) {
      const remark = sap.ui.getCore().byId("MIF_id_remark").getValue();
      oModelData.Status = statusValue;
      oModelData.NoofDays = String(oModelData.NoofDays);
      if (this._isAccountant) {
        oModelData.AccountRemark = remark
        if (statusValue !== "Send to account" || statusValue !== "Paid") oModelData.ManagerComment = remark;
        oModelData.AccountName = this.oLoginModel.EmployeeName;
      } else {
        oModelData.ManagerComment = remark;
      }
      this.oDialog.close();
      this.getBusyDialog();
      const requestData = { filters: { ID: oModelData.ID }, data: oModelData };
      this.ajaxUpdateWithJQuery("InboxDetails", requestData)
        .then(() => {
          this.MI_onSearch()
          this.closeBusyDialog();
          this.onBeforeShow();
          sap.m.MessageToast.show(this.getView().getModel("i18n").getResourceBundle().getText(successMsg));
        })
        .catch(() => {
          this.closeBusyDialog();
          sap.m.MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText(errorMsg));
        });
    },
    onBeforeShow() {
      const oTable = this.byId("MI_id_MyInboxTable");
      if (oTable && oTable.removeSelections) {
        oTable.removeSelections(); // Works only if selectionMode is enabled
      }
      ["MI_id_ButApprove", "MI_id_ButReject", "MI_id_ButReSend", "MI_id_ButPaid"].forEach(id => {
        const btn = this.byId(id);
        if (btn) btn.setVisible(false);
      });
    },
    MI_DownloadTableData: function () {
      var table = this.byId("MI_id_MyInboxTable");
      const oModelData = table.getModel("MyInboxModelData").getData();
      const aFormattedData = oModelData.map(item => {
        return {
          ...item,
          EndDate: Formatter.formatDate(item.EndDate),
          StartDate: Formatter.formatDate(item.StartDate),
          SubmittedDate: Formatter.formatDate(item.SubmittedDate),

        };
      });
      const aCols = [
        { label: this.i18nModel.getText("employeeName"), property: "EmpName", type: "string" },
        { label: this.i18nModel.getText("startDate"), property: "StartDate", type: "string" },
        { label: this.i18nModel.getText("endDate"), property: "EndDate", type: "string" },
        { label: this.i18nModel.getText("type"), property: "Type", type: "string" },
        { label: this.i18nModel.getText("subType"), property: "SubType", type: "string" },
        { label: this.i18nModel.getText("submittedDate"), property: "SubmittedDate", type: "string " },
        { label: this.i18nModel.getText("status"), property: "Status", type: "string" },
      ];
      const oSettings = {
        workbook: {
          columns: aCols,
          context: {
            sheetName: this.i18nModel.getText("enboxDetails")
          }
        },
        dataSource: aFormattedData,
        fileName: "Inbox_Details.xlsx"
      };
      const oSheet = new Spreadsheet(oSettings);
      oSheet.build().then(function () {
        MessageToast.show(this.i18nModel.getText("downloadsuccessfully"));
      }.bind(this))
        .finally(function () {
          oSheet.destroy();
        });
    },
    onShowMore: async function () {
      this.getBusyDialog();
      const response = await this.ajaxReadWithJQuery("AllComments", {
        ApplicationName: "Resignation"
      });
      const aAllComments = response.data || [];
      this.closeBusyDialog();

      var oEmployeeData = this.getView().getModel("sEmployeeModel").getData();
      var sEmpID = oEmployeeData[0].ID

      var aFilteredComments = aAllComments.filter(function (oComment) {
        return oComment.ApplicationName === "Resignation" && oComment.ID === sEmpID;
      });

      let oContent;
      if (aFilteredComments.length === 0) {
        // Show "No Data" message
        oContent = new sap.m.VBox({
          alignItems: "Center",
          justifyContent: "Center",
          items: [
            new sap.m.Text({ text: "No Data Found", design: "Bold" })
          ]
        }).addStyleClass("sapUiSmallMargin");
      } else {
        // Map into Timeline Items
        var aTimelineItems = aFilteredComments.slice().reverse().map(function (oComment) {
          return new sap.suite.ui.commons.TimelineItem({
            dateTime: new Date(oComment.CommentDateTime).toLocaleString(),
            title: (oComment.CommentedBy || "Anonymous") + " (" + (oComment.Status || "No Status") + ")",
            text: oComment.Comment || "No comment provided",
            userNameClickable: false,
            icon: "sap-icon://comment"
          });
        });

        // Create Timeline
        oContent = new sap.suite.ui.commons.Timeline({
          showHeader: false,
          enableBusyIndicator: false,
          width: "100%",
          sortOldestFirst: false,
          enableDoubleSided: false,
          content: aTimelineItems,
          showHeaderBar: false
        });
      }

      // Dialog
      var oDialog = new sap.m.Dialog({
        title: "Resignation Comments",
        contentWidth: "25rem",
        contentHeight: "15rem",
        draggable: true,
        resizable: true,
        content: [oContent],
        endButton: new sap.m.Button({
          text: "Close",
          type: "Transparent",
          press: function () {
            oDialog.close();
            oDialog.destroy();
          }
        })
      });
      oDialog.open();
    }
  });
});
