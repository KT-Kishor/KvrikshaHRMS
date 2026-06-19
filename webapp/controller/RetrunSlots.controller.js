sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "../utils/validation",
    "sap/m/MessageBox",
     "sap/m/MessageToast",

], function (
    BaseController,
    JSONModel,
    utils,
    MessageBox,
    MessageToast
) {
    "use strict";

    return BaseController.extend("sap.kt.com.minihrsolution.controller.RetrunSlots", {


        onInit: function () {
            this.getOwnerComponent().getRouter().getRoute("RouteReturnslots").attachMatched(this._onRouteMatched, this);

        },
        _onRouteMatched: async function () {
this.time=false

              var LoginFunction = await this.commonLoginFunction("ReturnSlots");
                if (!LoginFunction) return;
            this.byId("idHomeBtn").setIcon("sap-icon://nav-back")

            await this._fetchCommonData("EmployeeDetailsData", "empModel");

            var empData = this.getOwnerComponent().getModel("EmpModel").getData();

            var filteredEmp = empData.filter(emp => (emp.Role.includes("Admin") ||
                emp.Role.includes("IT Manager") || emp.Role.includes("IT Consultant")));

            var oModel = new JSONModel(filteredEmp);
            this.getView().setModel(oModel, "AdminModel");

            var Returnslotmodel = new JSONModel();
            this.getView().setModel(Returnslotmodel, "Returnslotmodel");
            var LoginModel = this.getView().getModel("LoginModel").getData()
            this.getView().getModel("LoginModel").setProperty("/HeaderName", "Return Slots");

            this.i18nModel = this.getView().getModel("i18n").getResourceBundle();
            this.getBusyDialog()

            this.onSearch()

        },
        onPressback: function () {
            this.getRouter().navTo("RouteAssetAssignment");
        },
        onLogout: function () {
            this.CommonLogoutFunction(); // Navigate to login page
        },
        RS_onPressClear: function () {
            this.byId("RS_id_EmployeeName").setSelectedKey("")
            this.byId("RS_id_Date").setValue("")
        },
        onSearchfilter:function(){
            this.getBusyDialog()
            this.onSearch()
        },
        onSearch: function () {
            var LoginModel = this.getView().getModel("LoginModel").getData()

            var EmployeeID = this.byId("RS_id_EmployeeName").getSelectedKey() || this.byId("RS_id_EmployeeName").getValue()

            var oDateRange = this.getView().byId("RS_id_Date");
            var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "yyyy-MM-dd" });
            var oStartDate = oDateRange.getDateValue();
            var oEndDate = oDateRange.getSecondDateValue();

            var filter = {
                BranchCode: LoginModel.BranchCode
            }

            if (EmployeeID) {
                filter.EmployeeID = EmployeeID
            }

            if (oStartDate && oEndDate) {
                filter.StartDate = oDateFormat.format(oStartDate);
                filter.EndDate = oDateFormat.format(oEndDate);
            }
            this.ajaxReadWithJQuery("ReturnSlots", filter).then((oData) => {
                var oFCIAerData = Array.isArray(oData.data) ? oData.data : [oData.data];
                var model = new JSONModel(oFCIAerData);
                this.closeBusyDialog()
                this.getOwnerComponent().setModel(model, "ReturnModel");
            })
        },
        RS_CreateSlot: function () {
            this.edit=false
            if (!this.RS_Dialog) {
                this.RS_Dialog = sap.ui.xmlfragment(
                    "sap.kt.com.minihrsolution.fragment.Returnslots",
                    this
                );
                this.getView().addDependent(this.RS_Dialog);
            }
            this.RS_Dialog.open();
            [
                "RS_id_Employeename",
                "RS_id_StartDate",
                "RS_id_EndDate",
                "RS_id_StartTime",
                "RS_id_EndTime",
                "RS_id_Location"
            ].forEach(function (sId) {
                var oControl = sap.ui.getCore().byId(sId);
                oControl.setValue("")
                if (oControl && oControl.setValueState) {
                    oControl.setValueState(sap.ui.core.ValueState.None);

                }
            });
            this._ViewDatePickersReadOnly(["RS_id_StartDate", "RS_id_EndDate"], sap.ui.getCore())

            this.byId("id_RS_Table").removeSelections()
            sap.ui.getCore().byId("RS_id_StartDate").setMinDate(new Date());
            sap.ui.getCore().byId("RS_id_Available").setSelectedIndex(0);
            sap.ui.getCore().byId("RS_id_EndDate").setEditable(true)




            var LoginModel = this.getView().getModel("LoginModel").getData()
            sap.ui.getCore().byId("RS_id_Employeename").setValue(LoginModel.EmployeeName)
        },
        RS_onCancelReturnSlot: function () {
            this.RS_Dialog.close();
            this.byId("id_RS_Table").removeSelections()
        },
        RS_onChangeemployeename: function (oEvent) {
            utils._LCstrictValidationComboBox(oEvent)

        },
        RS_onDateLiveChange: function (oEvent) {

            utils._LCvalidateMandatoryField(oEvent);

            var dStartDate = oEvent.getSource().getDateValue();
            sap.ui.getCore().byId("RS_id_EndDate").setValue("")

            if (dStartDate) {
                sap.ui.getCore().byId("RS_id_EndDate")
                    .setMinDate(new Date(dStartDate));
            }

            this._calculateEndDate();
            sap.ui.getCore().byId("RS_id_StartTime").setValue("").setValueState("None")
            sap.ui.getCore().byId("RS_id_EndTime").setValue("").setValueState("None")

        },
        RS_onDateEndLiveChange: function (oEvent) {
            utils._LCvalidateMandatoryField(oEvent);
            sap.ui.getCore().byId("RS_id_StartTime").setValue("").setValueState("None")
            sap.ui.getCore().byId("RS_id_EndTime").setValue("").setValueState("None")

        },

        onavailableTypeSelect: function (oEvent) {
            this._calculateEndDate();
        },

        _calculateEndDate: function () {

            var oStartDatePicker = sap.ui.getCore().byId("RS_id_StartDate");
            var oEndDatePicker = sap.ui.getCore().byId("RS_id_EndDate");
            var oRadioGroup = sap.ui.getCore().byId("RS_id_Available");

            var dStartDate = oStartDatePicker.getDateValue();

            if (!dStartDate) {
                return;
            }

            // Set End Date minimum as Start Date
            oEndDatePicker.setMinDate(new Date(dStartDate));

            var iSelectedIndex = oRadioGroup.getSelectedIndex();
            var dEndDate = new Date(dStartDate);

            switch (iSelectedIndex) {
                case 0: // Daily
                    break;

                case 1: // Weekly
                    dEndDate.setDate(dEndDate.getDate() + 7);
                    break;

                case 2: // Monthly
                    dEndDate.setMonth(dEndDate.getMonth() + 1);
                    break;
            }

            if (iSelectedIndex === 1 || iSelectedIndex === 2) {

                oEndDatePicker.setDateValue(dEndDate);

                var oModel = this.getView().getModel("Returnslotmodel");

                oModel.setProperty(
                    "/EndDate",
                    sap.ui.core.format.DateFormat.getDateInstance({
                        pattern: "dd/MM/yyyy"
                    }).format(dEndDate)
                );
                sap.ui.getCore().byId("RS_id_EndDate").setEditable(false)
            }
        },
        LocationChange:function(oEvent){
            utils._LCvalidateMandatoryField(oEvent);     
        },
        convertTimeToMinutes: function (sTime) {

            var aParts = sTime.trim().split(" ");
            var iHour = parseInt(aParts[0], 10);
            var sPeriod = aParts[1].toUpperCase();

            if ((sPeriod === "PM" || sPeriod === "pm") && iHour !== 12) {
                iHour += 12;
            }

            if ((sPeriod === "AM" || sPeriod === "am") && iHour === 12) {
                iHour = 0;
            }

            return iHour * 60;
        },
        RS_onSaveReturnSlot: async function () {
            var aReturnData = this.getView().getModel("ReturnModel").getData() || [];
            var oModel = this.getView().getModel("Returnslotmodel").getData();

            // Check duplicate slot
          

            // Existing validation code
            if (
                !utils._LCvalidateMandatoryField(sap.ui.getCore().byId("RS_id_Employeename"), "ID") ||
                !utils._LCvalidateMandatoryField(sap.ui.getCore().byId("RS_id_StartDate"), "ID") ||
                !utils._LCvalidateMandatoryField(sap.ui.getCore().byId("RS_id_EndDate"), "ID") ||
                !utils._LCvalidateMandatoryField(sap.ui.getCore().byId("RS_id_StartTime"), "ID") 
              
            ) {
                MessageToast.show(
                    this.i18nModel.getText("mandatoryFieldsError")
                );
                return;
            }
             if(!utils._LCvalidateMandatoryField(sap.ui.getCore().byId("RS_id_EndTime"), "ID")){
                  MessageToast.show(
                    this.i18nModel.getText("mandatoryFieldsError")
                );
                return;
            }

            if(this.time===false)
          {
            sap.ui.getCore().byId("RS_id_EndTime").setValueState("Error")
             MessageToast.show(
                    this.i18nModel.getText("mandatoryFieldsError")
                );
                return;
          }
             if (
                !utils._LCvalidateMandatoryField(sap.ui.getCore().byId("RS_id_Location"), "ID")
              
            ) {
                MessageToast.show(
                    this.i18nModel.getText("mandatoryFieldsError")
                );
                return;
            }

              var sStartDate = oModel.StartDate.split("/").reverse().join("-");
            var sEndDate = oModel.EndDate.split("/").reverse().join("-");
            var sEmployeeID =this.getView().getModel("LoginModel").getProperty("/EmployeeID");
       if (this.edit === true) {

    var bChanged =
        this._originalData.StartDate !== sStartDate ||
        this._originalData.EndDate !== sEndDate ||
        this._originalData.StartTime !== oModel.StartTime ||
        this._originalData.EndTime !== oModel.EndTime;

    if (bChanged) {

        var bExists = aReturnData.some((oItem) => {

            // Skip current record
            if (String(oItem.SlotID) === String(oModel.SlotID)) {
                return false;
            }

            if (oItem.EmployeeID !== sEmployeeID) {
                return false;
            }

            // Date overlap check
            var existingStartDate = new Date(oItem.StartDate.split("T")[0]);
            var existingEndDate = new Date(oItem.EndDate.split("T")[0]);

            var newStartDate = new Date(sStartDate);
            var newEndDate = new Date(sEndDate);

            var bDateOverlap =
                newStartDate <= existingEndDate &&
                newEndDate >= existingStartDate;

            if (!bDateOverlap) {
                return false;
            }

            // Time overlap check
            var existingStart = this.convertTimeToMinutes(oItem.StartTime);
            var existingEnd = this.convertTimeToMinutes(oItem.EndTime);

            var newStart = this.convertTimeToMinutes(oModel.StartTime);
            var newEnd = this.convertTimeToMinutes(oModel.EndTime);

            var bTimeOverlap =
                newStart < existingEnd &&
                newEnd > existingStart;

            return bTimeOverlap;

        });

        if (bExists) {
            MessageToast.show(this.i18nModel.getText("Aslotalreadyexistsfortheselected"));
            return;
        }
    }
}else{

           var bExists = aReturnData.some((oItem) => {

    if (oItem.EmployeeID === sEmployeeID) {

        var existingStartDate = new Date(oItem.StartDate.split("T")[0]);
        var existingEndDate = new Date(oItem.EndDate.split("T")[0]);

        var newStartDate = new Date(sStartDate);
        var newEndDate = new Date(sEndDate);

        // Date range overlap
        var bDateOverlap =
            newStartDate <= existingEndDate &&
            newEndDate >= existingStartDate;

        if (bDateOverlap) {

            var existingStart = this.convertTimeToMinutes(oItem.StartTime);
            var existingEnd = this.convertTimeToMinutes(oItem.EndTime);

            var newStart = this.convertTimeToMinutes(oModel.StartTime);
            var newEnd = this.convertTimeToMinutes(oModel.EndTime);

            // Time overlap
            return newStart < existingEnd && newEnd > existingStart;
        }
    }

    return false;
});

            if (bExists) {
                MessageToast.show(this.i18nModel.getText("Aslotalreadyexistsfortheselected"));
                return;
            }


}

            var oModel = this.getView().getModel("Returnslotmodel").getData();
            var EmployeeID = sap.ui.getCore().byId("RS_id_Employeename").getSelectedKey();

            var Payload = {
                EmployeeID: this.getView().getModel("LoginModel").getProperty("/EmployeeID"),
                EmployeeName: this.getView().getModel("LoginModel").getProperty("/EmployeeName"),
                Available: this.selectedValue || "Daily",
                StartDate: oModel.StartDate.split("/").reverse().join("-"),
                EndDate: oModel.EndDate.split("/").reverse().join("-"),
                StartTime: oModel.StartTime,
                EndTime: oModel.EndTime,
                Location: oModel.Location,
                BranchCode: this.getView().getModel("LoginModel").getProperty("/BranchCode")
            };

            try {

                if (oModel.SlotID) {
                     this.getBusyDialog()
                    await this.ajaxUpdateWithJQuery("ReturnSlots", {
                        filters: {
                            SlotID: oModel.SlotID
                        },
                        data: Payload
                    });
                    this.onSearch();
                    MessageToast.show(this.i18nModel.getText("Slotupdatedsuccessfully"));

                } else {
                     this.getBusyDialog()
                    await this.ajaxCreateWithJQuery("ReturnSlots", {
                        data: Payload
                    });
                    this.onSearch();
                    MessageToast.show(this.i18nModel.getText("Slotcreatedsuccessfully"));
                }

                this.RS_Dialog.close();
                this.byId("id_RS_Table").removeSelections();

            } catch (error) {
                console.error(error);
            }
        },
        onavailableTypeSelect: function (oEvent) {
            var iSelectedIndex = oEvent.getSource().getSelectedIndex();

            this.selectedValue =
                iSelectedIndex === 1 ? "Weekly" :
                    iSelectedIndex === 2 ? "Monthly" :
                        "Daily";

            if (iSelectedIndex === 1) {
                sap.ui.getCore().byId("RS_id_EndDate").setEditable(false).setValue("")
                sap.ui.getCore().byId("RS_id_StartDate").setValue("")

            } else if (iSelectedIndex === 2) {
                sap.ui.getCore().byId("RS_id_EndDate").setEditable(false).setValue("")
                sap.ui.getCore().byId("RS_id_StartDate").setValue("")


            } else {
                sap.ui.getCore().byId("RS_id_EndDate").setEditable(true).setValue("")
                sap.ui.getCore().byId("RS_id_StartDate").setValue("")

            }
        },
   
        RS_EditSlot: function (oEvent) {
            this.edit=true

            var oTable = this.byId("id_RS_Table");
            var oItem = oTable.getSelectedItem();

            if (!oItem) {
                MessageToast.show(this.i18nModel.getText("Pleaseselectarow"));
                return;
            }

            var oData = oItem.getBindingContext("ReturnModel").getObject();

            if(oData.EmployeeID!==this.getView().getModel("LoginModel").getProperty("/EmployeeID")){
                MessageToast.show(this.i18nModel.getText("Pleaseselectyourslot"));
                return;
            }

            this._originalData = {
                StartDate: oData.StartDate.split("T")[0],
                EndDate: oData.EndDate.split("T")[0],
                StartTime: oData.StartTime,
                EndTime: oData.EndTime
            };




            var oModel = new sap.ui.model.json.JSONModel({
                SlotID: oData.SlotID,
                EmployeeID: EmployeeID,
                EmpName: oData.EmployeeName,
                Available: oData.Available || "Daily",
                StartDate: (oData.StartDate.split("T")[0]).split("-").reverse().join("/"),
                EndDate: oData.EndDate.split("T")[0],
                StartTime: oData.StartTime,
                EndTime: oData.EndTime,
                Location: oData.Location
            });



            this.getView().setModel(oModel, "Returnslotmodel");

            if (!this.RS_Dialog) {
                this.RS_Dialog = sap.ui.xmlfragment(
                    "sap.kt.com.minihrsolution.fragment.Returnslots",
                    this
                );
                this.getView().addDependent(this.RS_Dialog);
            }

            if (oData.Available === "Monthly" || oData.Available === "Weekly") {
                sap.ui.getCore().byId("RS_id_EndDate").setEditable(false)
            } else {
                sap.ui.getCore().byId("RS_id_EndDate").setEditable(true)
            }
            var EmployeeID = sap.ui.getCore().byId("RS_id_Employeename").getSelectedKey()


            sap.ui.getCore().byId("RS_id_Available").setSelectedIndex(
                oData.Available === "Weekly" ? 1 :
                    oData.Available === "Monthly" ? 2 :
                        0
            );
            this._ViewDatePickersReadOnly(["RS_id_StartDate", "RS_id_EndDate"], sap.ui.getCore())


            sap.ui.getCore().byId("RS_id_Employeename").setValueState("None");
            sap.ui.getCore().byId("RS_id_Available").setValueState("None");
            sap.ui.getCore().byId("RS_id_StartDate").setValueState("None").setMinDate(new Date());
            sap.ui.getCore().byId("RS_id_EndDate").setValueState("None").setMinDate(new Date(oData.StartDate));
            sap.ui.getCore().byId("RS_id_StartTime").setValueState("None");
            sap.ui.getCore().byId("RS_id_EndTime").setValueState("None");

            this.RS_Dialog.open();
        },
        RS_onTimeLiveChange: function () {

            var oStartDatePicker = sap.ui.getCore().byId("RS_id_StartDate");
            var oEndDatePicker = sap.ui.getCore().byId("RS_id_EndDate");
            var oStartTimePicker = sap.ui.getCore().byId("RS_id_StartTime");
            var oEndTimePicker = sap.ui.getCore().byId("RS_id_EndTime");

            var dStartDate = oStartDatePicker.getDateValue();
            var dEndDate = oEndDatePicker.getDateValue();

            var sStartTime = oStartTimePicker.getValue();
            var sEndTime = oEndTimePicker.getValue();

            oEndTimePicker.setValueState("None");
            oStartTimePicker.setValueState("None")

            if (!dStartDate || !dEndDate || !sStartTime || !sEndTime) {
                return;
            }

            // Check if same date
            if (dStartDate.toDateString() === dEndDate.toDateString()) {

                var oDateFormat = sap.ui.core.format.DateFormat.getTimeInstance({
                    pattern: "hh a"
                });

                var dStartTime = oDateFormat.parse(sStartTime);
                var dEndTime = oDateFormat.parse(sEndTime);

                if (dEndTime <= dStartTime) {
                    oEndTimePicker.setValueState("Error");
                    oEndTimePicker.setValueStateText("Invalid Time");
                    this.time=false
                }else{
                    oEndTimePicker.setValueState("None");
                    this.time=true
                }
            }else{
                    this.time=true
            }
        },
        RS_DeleteSlot: async function () {

            var oTable = this.byId("id_RS_Table");
            var oItem = oTable.getSelectedItem();

            if (!oItem) {
                MessageToast.show(this.i18nModel.getText("Pleaseselectarow"));
                return;
            }

            var oData = oItem.getBindingContext("ReturnModel").getObject();

            if(oData.EmployeeID!==this.getView().getModel("LoginModel").getProperty("/EmployeeID")){
                 MessageToast.show(this.i18nModel.getText("Pleaseselectyourslotdelete"));
                 return;
                  }

            sap.m.MessageBox.confirm(
                "Are you sure you want to delete this slot?",
                {
                    title: "Confirm Deletion",
                    actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
                    emphasizedAction: sap.m.MessageBox.Action.YES,
                    onClose: async function (sAction) {
                        if (sAction === sap.m.MessageBox.Action.YES) {
                            try {
                                this.getBusyDialog()
                                await this.ajaxDeleteWithJQuery("ReturnSlots", {
                                    filters: {
                                        SlotID: oData.SlotID
                                    }
                                });

                                this.onSearch();
                                MessageToast.show(this.i18nModel.getText("Slotdeletedsuccessfully"));
                                this.byId("id_RS_Table").removeSelections();

                            } catch (oError) {
                                MessageToast.show(this.i18nModel.getText("Failedtodeleteslot"));
                            }
                        } else {
                            this.byId("id_RS_Table").removeSelections();
                        }
                    }.bind(this)
                }
            );
        }

    });
});