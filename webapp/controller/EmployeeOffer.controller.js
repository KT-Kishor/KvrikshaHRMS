sap.ui.define(["./BaseController", "../utils/validation", "sap/m/MessageToast", "../model/formatter", "sap/ui/export/Spreadsheet"], function (BaseController, utils, MessageToast, Formatter, Spreadsheet) {
  "use strict";
  return BaseController.extend("sap.kt.com.minihrsolution.controller.EmployeeOffer", {
    Formatter: Formatter,
    onInit: function () {
      // Calculate max date as 18 years before today
      var today = new Date();
      var maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
      var oDateModel = new sap.ui.model.json.JSONModel();
      oDateModel.setData({
        maxDate: maxDate,
        focusedDate: new Date(2000, 0, 1),
        minDate: new Date(1950, 0, 1),
      });
      this.getView().setModel(oDateModel, "controller");
      this.getRouter().getRoute("RouteEmployeeOffer").attachMatched(this._onRouteMatched, this);
    },
    _onRouteMatched: async function (oEvent) {
        var LoginFunction = await this.commonLoginFunction("EmployeeOffer");
        if (!LoginFunction) return;

        this.getBusyDialog();
        this.i18nModel = this.getView().getModel("i18n").getResourceBundle();

        this.byId("EO_id_OnboardBtn").setEnabled(false);
        this.byId("EO_id_RejectBtn").setEnabled(false);
        this.byId("emp_id_ResendEmail").setEnabled(false);

        this.getView().getModel("LoginModel").setProperty(
            "/HeaderName",
            this.i18nModel.getText("pageTitleemployee")
        );

        this.oValue = oEvent.getParameter("arguments").valueEmp;
        const from = oEvent.getParameter("arguments").from;
        this.Filter = true;

        try {
            this._isClearPressed = false;

            // Apply default only if NOT coming from edit
            if (this.oValue === "EmployeeOffer" && from !== "EmployeeOfferDetails") {

                this.onClearAndSearch("EO_id_FilterBar"); // 

                const { startDate, endDate } = this._getCurrentYearDates();
                const oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
                    pattern: "yyyy-MM-dd",
                });

                const params = {
                    startDate: oDateFormat.format(startDate),
                    endDate: oDateFormat.format(endDate),
                };

                // Set UI date range
                const oDateControl = this.byId("EO_id_JoiningDate");
                if (oDateControl) {
                    oDateControl.setDateValue(startDate);
                    oDateControl.setSecondDateValue(endDate);
                }

                // Initial fetch
                await this._fetchCommonData("EmployeeOffer", "EmployeeOfferModelInitial", {
                    startDate: params.startDate,
                    endDate: params.endDate,
                });

                const oInitialModel = this.getView().getModel("EmployeeOfferModelInitial");
                const aInitialData = oInitialModel.getData();

                // Deduplicate ConsultantName
                const uniqueConsultants = [];
                const seenNames = new Set();

                aInitialData.forEach((item) => {
                    if (item.ConsultantName && !seenNames.has(item.ConsultantName)) {
                        seenNames.add(item.ConsultantName);
                        uniqueConsultants.push(item);
                    }
                });

                oInitialModel.setData(uniqueConsultants);

                this._updateBaseLocationModel(aInitialData);

                await this._fetchCommonData("EmployeeOffer", "EmployeeOfferModel", params);

            } else {
                // Preserve existing filters (edit/navigation case)
                await this.EO_onSearch();
            }

        // Role Model filter
        const oRoleModel = this.getView().getModel("RoleModel");
        if (oRoleModel) {
          let aRoles = oRoleModel.getData();
          aRoles = aRoles.filter((role) => role.Role !== "Contractor" && role.Role !== "Trainee");
          // if (!aRoles.length || aRoles[0].Role !== "") {
          //   aRoles.unshift({
          //     Role: "",
          //   });
          // }
          oRoleModel.setData(aRoles);
        }
        this.initializeBirthdayCarousel();
        this.closeBusyDialog(); // Close busy dialog after data fetch
      } catch (error) {
        this.closeBusyDialog();
      } finally {
        this.closeBusyDialog(); // Close after async call finishes
      }
    },
    _getCurrentYearDates: function () {
      var year = new Date().getFullYear();
      var startDate = new Date(year, 0, 1); // Jan 1
      var endDate = new Date(year, 11, 31); // Dec 31
      return { startDate, endDate };
    },
    //Back to tile page
    onPressback: function () {
      this.getRouter().navTo("RouteTilePage");
    },
    //Logout function
    onLogout: function () {
      this.getRouter().navTo("RouteLoginPage");
      this.CommonLogoutFunction();
    },
    //Navigation function
    EO_onPressEmployee: function (oEvent) {
      this.closeBusyDialog();
      var oParValue, value;
      if (oEvent.getSource().getId().lastIndexOf("EO_id_AddEOffBut") !== -1) {
        oParValue = "CreateOfferFlag";
        value = "CreateOffer";
      } else {
        oParValue = oEvent.getSource().getBindingContext("EmployeeOfferModel").getModel().getData()[oEvent.getSource().getBindingContextPath().split("/")[1]].ID;
        value = "UpdateOffer";
      }
      this.getRouter().navTo("RouteEmployeeOfferDetails", {
        sParOffer: oParValue,
        sParEmployee: value,
      });
    },
    //Onboard call
    EO_onOnboardPress: async function () {
      this.onHandleEmployeeAction("Onboarded", "onBoardEmployee");
      this._fetchCommonData("EmployeeDetailsData", "empModel");
    },
    //reject call
    EO_onRejectPress: function () {
      this.onHandleEmployeeAction("Rejected", "onRejectEmployee");
    },
    _updateBaseLocationModel: function (aData) {
      const uniqueLocations = [];
      const seenLocations = new Set();

      aData.forEach((item) => {
        if (item.BaseLocation && !seenLocations.has(item.BaseLocation)) {
          seenLocations.add(item.BaseLocation);
          uniqueLocations.push({
            BaseLocation: item.BaseLocation,
          });
        }
      });

      const oBaseLocModel = new sap.ui.model.json.JSONModel(uniqueLocations);
      this.getView().setModel(oBaseLocModel, "BaseLocationModel");
    },
    EO_onSearch: async function () {
      try {
        this.getBusyDialog();
        const filterItems = this.byId("EO_id_FilterBar").getFilterGroupItems();
        const params = {};
        let joiningDateProvided = false;

        // Extract values from filter items
        filterItems.forEach((item) => {
          const control = item.getControl();
          const key = item.getName();

          if (control && typeof control.getValue === "function") {
            const value = control.getValue().trim();
            params[key] = value;
          }

          if (key === "JoiningDate" && control.getDateValue() && control.getSecondDateValue()) {
            const oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
              pattern: "yyyy-MM-dd",
            });
            const start = oDateFormat.format(control.getDateValue());
            const end = oDateFormat.format(control.getSecondDateValue());
            params.startDate = start;
            params.endDate = end;
            joiningDateProvided = true;
          }
        });

        // Financial year logic
        const currentYear = new Date().getFullYear();
        let fyStart, fyEnd, financialYearLabel;

        if (new Date().getMonth() >= 3) {
          fyStart = new Date(currentYear, 3, 1);
          fyEnd = new Date(currentYear + 1, 2, 31);
          financialYearLabel = `${currentYear}-${currentYear + 1}`;
        } else {
          fyStart = new Date(currentYear - 1, 3, 1);
          fyEnd = new Date(currentYear, 2, 31);
          financialYearLabel = `${currentYear - 1}-${currentYear}`;
        }

        const formatDate = (date) => date.toISOString().split("T")[0];
        if (this._isClearPressed) {
          // Clear all filters
          delete params.startDate;
          delete params.endDate;
          delete params.FinancialYear;
          this._isClearPressed = false;
        } else {
          // Check if selected dates match financial year
          const startDate = new Date(params.startDate);
          const endDate = new Date(params.endDate);
          if (startDate.getTime() === fyStart.getTime() && endDate.getTime() === fyEnd.getTime()) {
            params.FinancialYear = financialYearLabel;
          }
        }

        await this._fetchCommonData("EmployeeOffer", "EmployeeOfferModelInitial", {
          startDate: params.startDate,
          endDate: params.endDate,
        });

        const oInitialModel = this.getView().getModel("EmployeeOfferModelInitial");
        const aInitialData = oInitialModel.getData();
        const uniqueConsultants = []; // Filter unique consultant names
        const seenNames = new Set();
        aInitialData.forEach((item) => {
          if (item.ConsultantName && !seenNames.has(item.ConsultantName)) {
            seenNames.add(item.ConsultantName);
            uniqueConsultants.push(item);
          }
        });
        oInitialModel.setData(uniqueConsultants);
        this._updateBaseLocationModel(aInitialData);
        // Fetch data
        await this._fetchCommonData("EmployeeOffer", "EmployeeOfferModel", params);
        this.EO_ButtonVisibility();
        this.closeBusyDialog();
      } catch (error) {
        this.closeBusyDialog();
        MessageToast.show(this.i18nModel.getText("commonErrorMessage"));
      }
    },
    // Update the status to 'Rejected' after confirmation
    onRejectEmployee: async function () {
      this.getBusyDialog();
      await this.updateCallForEmployeeOffer("Rejected");
      this.EO_ButtonVisibility();
    },
    //Common button visibility
    EO_ButtonVisibility: function () {
      this.byId("EO_id_TableEOffer").removeSelections(true);
      this.byId("EO_id_OnboardBtn").setEnabled(false);
      this.byId("EO_id_RejectBtn").setEnabled(false);
    },
    //Clear filter function
    EO_onPressClear: function () {
      var aFilterItems = this.byId("EO_id_FilterBar").getFilterGroupItems();
      aFilterItems.forEach(function (oItem) {
        var oControl = oItem.getControl(); // Get the associated control
        if (oControl) {
          if (oControl.setValue) {
            oControl.setValue(""); // Clear value for ComboBox, Input, DatePicker, etc.
          }
          if (oControl.setSelectedKey) {
            oControl.setSelectedKey(""); // Reset selection for dropdowns
          }
          if (oControl.setSelected) {
            oControl.setSelected(false); // Reset selection for Checkboxes
          }
        }
      });
      this._isClearPressed = true;
    },
    //Common  reject or onboard action handling
    onHandleEmployeeAction: function (status, actionMethod) {
      var oSelectedData = this.byId("EO_id_TableEOffer").getSelectedItem().getBindingContext("EmployeeOfferModel").getObject();
      this.oSelectedRow = oSelectedData;
      var sName = oSelectedData.Salutation + " " + oSelectedData.ConsultantName;
      var that = this;
      // Build message and title
      var sMessage = status === "Onboarded" ? that.i18nModel.getText("confirmOnboard", [sName]) : that.i18nModel.getText("confirmReject", [sName]);
      var sTitle = status === "Onboarded" ? that.i18nModel.getText("confirmTitleOnboard") : that.i18nModel.getText("confirmTitleReject");
      // Call reusable confirmation dialog
      that.showConfirmationDialog(
        sTitle,
        sMessage,
        function () {
          // onConfirm
          if (status === "Onboarded") {
            const oEmployeeDetailsModel = new sap.ui.model.json.JSONModel({
              //Common json data passing from frontend all record will be created from backend
              ID: oSelectedData.ID,
              Salutation: oSelectedData.Salutation,
              EmployeeName: oSelectedData.ConsultantName,
              Gender: oSelectedData.Gender,
              JoiningDate: oSelectedData.JoiningDate.split("T")[0],
              Role: " ",
              DateOfBirth: "",
              CompanyEmailID: "",
              EmployeeEmail: oSelectedData.EmployeeEmail,
              PermanentAddress: oSelectedData.ConsultantAddress,
              CorrespondenceAddress: oSelectedData.ConsultantAddress,
              Country: oSelectedData.Country,
              State: oSelectedData.State,
              CountryCode: oSelectedData.CountryCode ? oSelectedData.CountryCode : "IN",
              BaseLocation: oSelectedData.BaseLocation,
              AppraisalDate: oSelectedData.JoiningDate.split("T")[0],
              Designation: oSelectedData.Designation,
              Department: oSelectedData.Department,
              BranchCode: oSelectedData.BranchCode,
              CompanyCode: oSelectedData.CompanyCode,
              Branch: oSelectedData.Branch,
              STDCode: "+91",
              MobileNo: "",
              ManagerID: "",
              ManagerName: "",
              BloodGroup: "",
              EmployeeStatus: "Active",
              CTC: oSelectedData.CTC,
              Currency: "INR",
              JoiningBonus: oSelectedData.JoiningBonus,
              BasicSalary: oSelectedData.BasicSalary,
              HRA: oSelectedData.HRA,
              IncomeTax: oSelectedData.IncomeTax,
              MedicalInsurance: oSelectedData.MedicalInsurance,
              Gratuity: oSelectedData.Gratuity,
              VariablePay: oSelectedData.VariablePay,
              CostofCompany: oSelectedData.CostofCompany,
              Total: oSelectedData.Total,
              EmployeePF: oSelectedData.EmployeePF,
              EmployerPF: oSelectedData.EmployerPF,
              TotalDeduction: oSelectedData.TotalDeduction,
              EmploymentBond: oSelectedData.EmploymentBond,
              SpecailAllowance: oSelectedData.SpecailAllowance,
              PT: oSelectedData.PT,
              GrossPay: oSelectedData.GrossPay,
              VariablePercentage: oSelectedData.VariablePercentage,
              GrossPayMontly: oSelectedData.GrossPayMontly,
              HikePercentage: oSelectedData.HikePercentage,
              EffectiveDate: oSelectedData.JoiningDate.split("T")[0],
            });
            that.getView().setModel(oEmployeeDetailsModel, "oEmpolyeeDetailsModel");
            that._commonFragmentOpenOffer(that, "OnboardEmployee");
          } else {
            that[actionMethod]();
          }
        },
        function () {
          that.EO_ButtonVisibility();
        },
        that.i18nModel.getText("OkButton"),
        that.i18nModel.getText("CancelButton")
      );
    },
    //Common Dialog opening function
    _commonFragmentOpenOffer: function (name, fragmentName) {
      if (!this.oDialog) {
        sap.ui.core.Fragment.load({
          name: "sap.kt.com.minihrsolution.fragment.OnboardEmployee",
          controller: this,
        }).then((dialog) => {
          this.oDialog = dialog;
          this.getView().addDependent(this.oDialog);
          //sap.ui.getCore().byId("OEF_id_DateofBirth").setMaxDate(new Date());
          this._FragmentDatePickersReadOnly(["OEF_id_DateofBirth"]);
          this.oDialog.open();
        });
      } else {
        this._FragmentDatePickersReadOnly(["OEF_id_DateofBirth"]);
        this.oDialog.open();
      }
    },
    OEF_onPressClose: function () {
      const fields = ["OEF_id_CompanyMail", "OEF_id_DateofBirth", "OEF_id_Mobile", "OEF_id_EmployeeRole", "OEF_id_Country", "OEF_id_PAddress", "OEF_id_CAddress", "OEF_id_blood", "OEF_id_Manager"];
      fields.forEach((field) => {
        sap.ui.getCore().byId(field).setValueState("None");
      });
      this.oDialog.close();
      this.EO_ButtonVisibility();
    },
    //Validate date
    validateDate: function (oEvent) {
      utils._LCvalidateDate(oEvent);
    },
    //Validate email
    validateEmail: function (oEvent) {
      utils._LCvalidateEmail(oEvent);
    },

    STDcodeChange: function (oEvent) {
      utils._LCstrictValidationComboBox(oEvent);
      const oComboBox = oEvent.getSource();
      const sSelectedKey = oComboBox.getSelectedKey();
      const oCodeModel = this.getView().getModel("codeModel");
      const aItems = oCodeModel.getProperty("/");
      const sCountryCode = aItems.find((item) => item.country === sSelectedKey)?.country_code;
      const oEmpolyeeDetailsModel = this.getView().getModel("oEmpolyeeDetailsModel");
      if (oEmpolyeeDetailsModel && sCountryCode) {
        oEmpolyeeDetailsModel.setProperty("/Country", sCountryCode);
      }
      const oMobileInput = sap.ui.getCore().byId("OEF_id_Mobile");
      if (oMobileInput) {
        oMobileInput.setValue("");
      }
      if (oMobileInput && sCountryCode) {
        if (sCountryCode === "IN") {
          oMobileInput.setMaxLength(10);
        } else {
          oMobileInput.setMaxLength(20);
        }
      }
    },
    //Validate comobox
    validateCombo: function (oEvent) {
      utils._LCstrictValidationComboBox(oEvent);
    },
    validateMandetory: function (oEvent) {
      utils._LCvalidateMandatoryField(oEvent);
    },
    //Onboard function

    OEF_onPressOnBoard: function (oEvent) {
      try {
        var oModel = this.getView().getModel("oEmpolyeeDetailsModel").getData();
        var bIsMobileValid = this._validateMobileNumberLocal({
          getSource: () => sap.ui.getCore().byId("OEF_id_Mobile"),
        });

        if (
          utils._LCstrictValidationComboBox(sap.ui.getCore().byId("OEF_id_EmployeeRole"), "ID") &&
          utils._LCstrictValidationComboBox(sap.ui.getCore().byId("OEF_id_Country"), "ID") &&
          utils._LCvalidateMandatoryField(sap.ui.getCore().byId("OEF_id_State"), "ID") &&
          utils._LCvalidateMandatoryField(sap.ui.getCore().byId("idSelect"), "ID") &&
          utils._LCvalidateEmail(sap.ui.getCore().byId("OEF_id_CompanyMail"), "ID") &&
          utils._LCvalidateMandatoryField(sap.ui.getCore().byId("OEF_id_PAddress"), "ID") &&
          utils._LCvalidateMandatoryField(sap.ui.getCore().byId("OEF_id_CAddress"), "ID") &&
          utils._LCvalidateDate(sap.ui.getCore().byId("OEF_id_DateofBirth"), "ID") &&
          utils._LCstrictValidationComboBox(sap.ui.getCore().byId("OEF_id_blood"), "ID") &&
          utils._LCstrictValidationComboBox(sap.ui.getCore().byId("OEF_id_STDCode"), "ID") &&
          bIsMobileValid && // Call the new validation function here
          utils._LCstrictValidationComboBox(sap.ui.getCore().byId("OEF_id_Manager"), "ID")
        ) {
          var oPayload = {
            tableName: "EmployeeDetails",
            data: oModel,
          };
          oModel.DateOfBirth = oModel.DateOfBirth.split("/").reverse().join("-");
          oModel.ManagerID = sap.ui.getCore().byId("OEF_id_Manager").getSelectedItem().getAdditionalText();
          this.getBusyDialog();
          this.ajaxCreateWithJQuery("EmployeeDetails", oPayload)
            .then((oData) => {
              if (oData.success) {
                this.EO_onSearch();
                this.oDialog.close();
                MessageToast.show(this.i18nModel.getText("onBoardSuccess"));
                this.getView().getModel("empModel").refresh(true);
              } else {
                MessageToast.show(this.i18nModel.getText("mandetoryFields"));
              }
              this.closeBusyDialog();
            })
            .catch((error) => {
              this.closeBusyDialog();
              MessageToast.show(error.message || error.responseText);
            });
        } else {
          MessageToast.show(this.i18nModel.getText("mandetoryFields"));
        }
      } catch (error) {
        this.closeBusyDialog();
        MessageToast.show(this.i18nModel.getText("technicalError"));
      }
    },
    //Common update function
    updateCallForEmployeeOffer: async function (oStatus, oDialogRef) {
      try {
        this.getBusyDialog();
        this.oSelectedRow.Status = oStatus;
        var oModelOffer = {
          data: this.oSelectedRow,
          filters: {
            ID: this.oSelectedRow.ID,
          },
        };
        await this.ajaxUpdateWithJQuery("EmployeeOffer", oModelOffer)
          .then((oData) => {
            if (oData.success) {
              var sSuccessMessage = oStatus === "Onboarded" ? this.i18nModel.getText("onBoardSuccess") : this.i18nModel.getText("offerEmpReject");
              MessageToast.show(sSuccessMessage);
              this.EO_onSearch();
              if (oDialogRef && oDialogRef.close) oDialogRef.close();
              this.closeBusyDialog();
            }
          })
          .catch((error) => {
            if (oDialogRef && oDialogRef.close) oDialogRef.close();
            this.closeBusyDialog();
            MessageToast.show(error.message || error.responseText);
          });
      } catch (error) {
        this.closeBusyDialog();
        if (oDialogRef && oDialogRef.close) oDialogRef.close();
        MessageToast.show(this.i18nModel.getText("technicalError"));
      }
    },
    EO_onSelectionRadRowE: function (oEvent) {
      var oSelectedItem = oEvent.getParameter("listItem");
      // If an item is selected, check the status and update button visibility accordingly
      if (oSelectedItem) {
        var sStatus = oSelectedItem.getBindingContext("EmployeeOfferModel").getProperty("Status");
        var isDisabled = sStatus === "Onboarded" || sStatus === "Rejected";
        this.byId("EO_id_OnboardBtn").setEnabled(!isDisabled);
        this.byId("EO_id_RejectBtn").setEnabled(!isDisabled);
        this.byId("emp_id_ResendEmail").setEnabled(sStatus === "Onboarded");
      }
    },
    //Base location change code change
    EO_onBaseLocationChange: function (oEvent) {
      this.handleBaseLocationChange(
        oEvent,
        "BaseLocationModel", // Source model
        "oEmpolyeeDetailsModel", // Target model
        "/BranchCode" // Path in target model
      );
    },
    _validateMobileNumberLocal: function (oEvent) {
      const oInput = oEvent.getSource();
      const sValue = oInput.getValue();
      const sValueTrimmed = sValue.trim();
      // Get the STD code ComboBox directly from the UI
      const oSTDComboBox = sap.ui.getCore().byId("OEF_id_STDCode");
      // Get the CodeModel to find the corresponding country code
      const oCodeModel = this.getView().getModel("codeModel");
      const aItems = oCodeModel.getProperty("/");
      let sCountryCode;
      // Check if the ComboBox exists and has a selected key
      if (oSTDComboBox && oSTDComboBox.getSelectedKey()) {
        const sSelectedKey = oSTDComboBox.getSelectedKey();
        const oSelectedItem = aItems.find((item) => item.country === sSelectedKey);
        if (oSelectedItem) {
          sCountryCode = oSelectedItem.country_code;
        }
      }
      // Default to "IN" if no valid country code is found
      if (!sCountryCode) {
        sCountryCode = "IN";
      }
      oInput.setValueState(sap.ui.core.ValueState.None);
      oInput.setValueStateText("");
      if (sValueTrimmed.length === 0) {
        return true;
      }
      if (!/^\d+$/.test(sValueTrimmed)) {
        oInput.setValueState(sap.ui.core.ValueState.Error);
        oInput.setValueStateText("Only numbers are allowed");
        return false;
      }
      if (sValueTrimmed.startsWith("0")) {
        oInput.setValueState(sap.ui.core.ValueState.Error);
        oInput.setValueStateText("Mobile Number should not begin with zero");
        return false;
      }
      if (sCountryCode === "IN") {
        if (sValueTrimmed.length !== 10) {
          oInput.setValueState(sap.ui.core.ValueState.Error);
          oInput.setValueStateText("Mobile Number must be 10 digits long");
          return false;
        }
      } else {
        if (sValueTrimmed.length < 4 || sValueTrimmed.length > 20) {
          oInput.setValueState(sap.ui.core.ValueState.Error);
          oInput.setValueStateText("Enter a valid mobile number (between 4-20 digits)");
          return false;
        }
      }
      return true;
    },
    validateMobileNo: function (oEvent) {
      this._validateMobileNumberLocal(oEvent);
    },
    OE_onChangeCountry: function (oEvent) {
      utils._LCstrictValidationComboBox(oEvent, "oEvent");
      if (oEvent.getSource().getValue() === '') {
        oEvent.getSource().setValueState("None")
      }
      var oSelectedItem = oEvent.getSource().getSelectedItem();
      if (!oSelectedItem) return;
      var sCountryCode = oSelectedItem.getAdditionalText();
      var oStateCombo = this.byId("OEF_id_State"); // Filter States
      var oStateBinding = oStateCombo.getBinding("items");
      oStateBinding.filter(new sap.ui.model.Filter("countryCode", sap.ui.model.FilterOperator.EQ, sCountryCode));
      oStateCombo.setSelectedKey(""); // Reset state selection
      var oCityCombo = this.byId("idSelect"); // Clear city
      oCityCombo.getBinding("items").filter([]);
      oCityCombo.setSelectedKey("");
    },
    OE_onChangeState: function (oEvent) {
      utils._LCstrictValidationComboBox(oEvent, "oEvent");
      if (oEvent.getSource().getValue() === '') {
        oEvent.getSource().setValueState("None")
      }
      var oSelectedItem = oEvent.getSource().getSelectedItem();
      if (!oSelectedItem) return;
      var sStateName = oSelectedItem.getAdditionalText() || oSelectedItem.getKey();
      var sCountryCode = this.byId("OEF_id_Country").getSelectedItem().getAdditionalText();
      var oCityCombo = this.byId("idSelect"); // Filter Cities
      var oCityBinding = oCityCombo.getBinding("items");
      oCityBinding.filter([
        new sap.ui.model.Filter("stateName", sap.ui.model.FilterOperator.EQ, sStateName),
        new sap.ui.model.Filter("countryCode", sap.ui.model.FilterOperator.EQ, sCountryCode)
      ]);
      oCityCombo.setSelectedKey(""); // Reset city selection
    },
    EO_DownloadTableData: function () {
      var table = this.byId("EO_id_TableEOffer");
      const oModelData = table.getModel("EmployeeOfferModel").getData();
      const aFormattedData = oModelData.map((item) => {
        return {
          ...item,
          JoiningDate: Formatter.formatDate(item.JoiningDate),
          //   PayByDate: Formatter.formatDate(item.PayByDate),
          //   TotalAmountCurrency: item.TotalAmount + " " + item.Currency
        };
      });
      const aCols = [
        { label: this.i18nModel.getText("salutation"), property: "Salutation", type: "string" },
        { label: this.i18nModel.getText("employeeName"), property: "ConsultantName", type: "string" },
        { label: this.i18nModel.getText("designation"), property: "Designation", type: "string" },
        { label: this.i18nModel.getText("baseLocation"), property: "BaseLocation", type: "string" },
        { label: this.i18nModel.getText("joiningDate"), property: "JoiningDate", type: "string" },
        { label: this.i18nModel.getText("emailId"), property: "EmployeeEmail", type: "string" },
        { label: this.i18nModel.getText("ctc"), property: "CTC", type: "string " },
      ];
      const oSettings = {
        workbook: {
          columns: aCols,
          context: {
            sheetName: this.i18nModel.getText("offerDetail"),
          },
        },
        dataSource: aFormattedData,
        fileName: "Employee_Offer_Details.xlsx",
      };
      const oSheet = new Spreadsheet(oSettings);
      oSheet
        .build()
        .then(
          function () {
            MessageToast.show(this.i18nModel.getText("downloadsuccessfully"));
          }.bind(this)
        )
        .finally(function () {
          oSheet.destroy();
        });
    },
    getGroupHeader: function (oGroup) {
      return this.getStyledGroupHeader(oGroup);
    },

    Emp_onResendOnboardingEmail: function () {
      var oTable = this.byId("EO_id_TableEOffer");
      var oSelectedItem = oTable.getSelectedItem();

      if (!oSelectedItem) return MessageToast.show("Please select one record.");

      var oData = oSelectedItem.getBindingContext("EmployeeOfferModel").getObject();

      this.getBusyDialog();

      this.ajaxCreateWithJQuery("EmployeeOnboardEmail", {
        EmployeeID: oData.EmployeeID || "",
        UserName: oData.ConsultantName,
        toEmailID: [oData.EmployeeEmail],
        flag: "X"
      })
        .then((response) => {
          this.closeBusyDialog();
          MessageToast.show("Onboarding email sent successfully.");
          this.byId("emp_id_ResendEmail").setEnabled(false);
          this.byId("EO_id_TableEOffer").removeSelections(true);
        })
        .catch((error) => {
          this.closeBusyDialog();
          MessageToast.show(error.message || error.responseText || "Error while sending email.");
        });
    }

  });
});
