sap.ui.define([
    "./BaseController", //call base controller
    "sap/ui/model/json/JSONModel", //json model
    "sap/m/MessageToast", // Import MessageToast for notifications
    "../utils/validation", //  Import formatter utility
    "sap/m/MessageBox", // Import MessageBox for alerts/confirmations
    "sap/ui/export/Spreadsheet",
],
    function (BaseController, JSONModel, MessageToast, utils, MessageBox, Spreadsheet) {
        "use strict";
        return BaseController.extend("sap.kt.com.minihrsolution.controller.ManageCustomer", {
            onInit: function () {
                this.getRouter().getRoute("RouteManageCustomer").attachMatched(this._onRouteMatched, this);
            },

            _onRouteMatched: async function (oEvent) {
                var LoginFUnction = await this.commonLoginFunction("Customer");
                if (!LoginFUnction) return;
                this.getBusyDialog(); // Show busy dialog
                var ViewModel = new JSONModel({
                    update: true
                });
                this.getView().setModel(ViewModel, "ViewModel")
                this.i18nModel = this.getView().getModel("i18n").getResourceBundle(); // Get i18n model
                this.byId("MC_id_CustTable").removeSelections(true); // Clear table selection
                this.getView().getModel("LoginModel").setProperty("/HeaderName", this.i18nModel.getText("headerCustomer")); // Set header name
                this.oValue = oEvent.getParameter("arguments").value;
                try {
                    if (this.oValue === "ManageCustomer" || this.oValue === "MSA" || this.oValue === "Company Invoice") {
                        await this.readCallForManageCustomer("Initial");
                        this.MC_onClear(); // Clear the filter bar
                    } else {
                        await this.MC_onSearch(); // Filter function for trainee
                    }
                } catch (error) {
                    sap.m.MessageToast.show(error.message || error.responseText);
                } finally {
                    this.closeBusyDialog(); // Hide in all cases
                }
                this.initializeBirthdayCarousel();
            },
              onGlobalSearch: function (oEvent) {
            const sQuery = oEvent.getParameter("newValue");
            const oTable = this.byId("MC_id_CustTable");
           const oBinding = oTable.getBinding("items");
            let aFilters = [];
            if (sQuery) {
                aFilters = [
                    new sap.ui.model.Filter({
                        filters: [
                            new sap.ui.model.Filter("companyName", sap.ui.model.FilterOperator.Contains, sQuery.toString()),
                            new sap.ui.model.Filter("name", sap.ui.model.FilterOperator.Contains, sQuery.toString()),
                            new sap.ui.model.Filter("GST", sap.ui.model.FilterOperator.Contains, sQuery.toString()),
                            new sap.ui.model.Filter("type", sap.ui.model.FilterOperator.Contains, sQuery.toString()),
                            new sap.ui.model.Filter("value", sap.ui.model.FilterOperator.Contains, sQuery.toString()),
                            new sap.ui.model.Filter("mailID", sap.ui.model.FilterOperator.Contains, sQuery.toString()),
                            new sap.ui.model.Filter("mobileNo", sap.ui.model.FilterOperator.Contains, sQuery.toString())    
                        ],
                        and: false
                    })
                ];
            }
            oBinding.filter(aFilters);
        },

            //common Dialog Function
            manageCustomerDetails: function (bIsEdit, companycodeVal) {
                var oModel;
                var data = {
                    save: false,
                    submit: true,
                    CC_id_CustInput: false,
                    selectedIndex: 0
                };
                var visibleData = new JSONModel(data); // Create a new JSON model for visibility
                this.getView().setModel(visibleData, "visiblePlay");
                if (bIsEdit) {
                    var oVisiableModel = this.getView().getModel("visiblePlay");
                    if (companycodeVal) {
                        oVisiableModel.setProperty("/CompanyCode", true)
                    } else {
                        oVisiableModel.setProperty("/CompanyCode", false)
                    }
                    oVisiableModel.setProperty("/save", true); // Set save button visibility
                    oVisiableModel.setProperty("/submit", false); // Set submit button visibility
                    var oTable = this.byId("MC_id_CustTable").getSelectedItem();
                    if (oTable === null) {
                        return MessageBox.error(this.i18nModel.getText("msgCustomer2"));
                    } else {
                        var oData = oTable.getBindingContext("CreateCustomerModel").getObject();
                        this._originalCustomerData = JSON.parse(JSON.stringify(oData));
                        if (oData.GST)
                            this.getView().getModel("visiblePlay").setProperty("/CC_id_CustInput", true);
                        if (oData.type === "IGST") {
                            this.getView().getModel("visiblePlay").setProperty("/selectedIndex", 1);
                        }
                        this.gstValue = oData.value;
                        oModel = new JSONModel(oData);
                    }
                } else {
                    this._originalCustomerData = null; // Reset original data
                    var oData = {
                        companyName: "",
                        CompanyCode: "",
                        name: "",
                        PAN: "",
                        GST: "",
                        address: "",
                        mailID: "",
                        mobileNo: "",
                        LUT: "",
                        type: "",
                        value: "",
                        salutation: "Mr.",
                        customerEmail: "",
                        stdCode: "",
                        country: "",
                        state: "",
                        baseLocation: "",
                        HeadPosition: ""
                    };
                    oModel = new JSONModel(oData);
                }
                this.getView().setModel(oModel, "CustomerModel");
                if (this.oManageCustomerDialog){
                        this.oManageCustomerDialog.destroy();
                        this.oManageCustomerDialog = null;
                }
                if (!this.oManageCustomerDialog) {
                    sap.ui.core.Fragment.load({
                        name: "sap.kt.com.minihrsolution.fragment.CreateCustomer",
                        controller: this,
                    }).then(
                        function (oManageCustomerDialog) {
                            this.oManageCustomerDialog = oManageCustomerDialog;
                            this.getView().addDependent(this.oManageCustomerDialog);
                            this._resetDialogFields(bIsEdit);
                            this._applyCountryStateCityFilters()
                            this.oManageCustomerDialog.open(); // Open the dialog
                        }.bind(this)
                    );
                } else {
                    this._resetDialogFields(bIsEdit);
                    this._applyCountryStateCityFilters()
                    // Reset fields to original data
                    this.oManageCustomerDialog.open(); // Open the dialog
                }
            },

            _applyCountryStateCityFilters: function () {
                const oModel = this.getView().getModel("CustomerModel");
                const oCountryCB = sap.ui.getCore().byId("MC_id_Country");
                const oStateCB = sap.ui.getCore().byId("MC_id_State");
                const oSourceCB = sap.ui.getCore().byId("MC_id_City");

                const sCountry = oModel.getProperty("/country");     // e.g. "Australia"
                const sState = oModel.getProperty("/state");       // e.g. "Queensland"
                const sSource = oModel.getProperty("/baseLocation");      // e.g. "Bongaree"

                // Reset all filters
                oStateCB.getBinding("items")?.filter([]);
                oSourceCB.getBinding("items")?.filter([]);

                if (sCountry) {
                    // Find countryCode by name
                    const aCountryData = this.getView().getModel("CountryModel").getData();
                    const oCountryObj = aCountryData.find(c => c.countryName === sCountry);

                    if (oCountryObj) {
                        const sCountryCode = oCountryObj.code;

                        // Filter States by Country
                        oStateCB.getBinding("items")?.filter([
                            new sap.ui.model.Filter("countryCode", sap.ui.model.FilterOperator.EQ, sCountryCode)
                        ]);

                        if (sState) {
                            // Filter Cities by State + Country
                            const aFilters = [
                                new sap.ui.model.Filter("stateName", sap.ui.model.FilterOperator.EQ, sState),
                                new sap.ui.model.Filter("countryCode", sap.ui.model.FilterOperator.EQ, sCountryCode)
                            ];
                            oSourceCB.getBinding("items")?.filter(aFilters);
                        }
                    }
                }

                // Ensure values are set back in UI
                oCountryCB.setValue(sCountry || "");
                oStateCB.setValue(sState || "");
                oSourceCB.setValue(sSource || "");
            },

            _resetDialogFields: function (bIsEdit) {
                // Clear all ValueStates
                sap.ui.getCore().byId("MC_id_CustCompanyName").setValueState("None");
                sap.ui.getCore().byId("MC_id_CustCustomerName").setValueState("None");
                sap.ui.getCore().byId("MC_id_CustomGst").setValueState("None");
                sap.ui.getCore().byId("MC_id_CustomPan").setValueState("None");
                sap.ui.getCore().byId("MC_id_CustMail").setValueState("None");
                sap.ui.getCore().byId("MC_id_FinanceEmail").setValueState("None");
                sap.ui.getCore().byId("MC_id_CustMob").setValueState("None");
                sap.ui.getCore().byId("MC_id_Country").setValueState("None");
                sap.ui.getCore().byId("MC_id_State").setValueState("None");
                sap.ui.getCore().byId("MC_id_City").setValueState("None");
                sap.ui.getCore().byId("MC_id_codeModel").setValueState("None");
                sap.ui.getCore().byId("MC_id_CustAddress").setValueState("None");
                sap.ui.getCore().byId("MC_id_HeadPosition").setValueState("None");

                if (bIsEdit && this._originalCustomerData) {
                    // Set fallback/default values if fields are missing or empty
                    this._originalCustomerData.stdCode = this._originalCustomerData.stdCode || "";
                    this._originalCustomerData.GST = this._originalCustomerData.GST || "";
                    this._originalCustomerData.LUT = this._originalCustomerData.LUT || "";
                    this._originalCustomerData.mobileNo = this._originalCustomerData.mobileNo || "";
                    this._originalCustomerData.type = this._originalCustomerData.type || "";
                    this._originalCustomerData.value = this._originalCustomerData.value || "";

                    // Set data back to CustomerModel
                    this.getView().getModel("CustomerModel").setData(JSON.parse(JSON.stringify(this._originalCustomerData)));

                    // Set selected index of radio group based on type
                    if (this._originalCustomerData.type === "IGST") {
                        sap.ui.getCore().byId("MC_id_groupCustGst").setSelectedIndex(1);
                    } else {
                        sap.ui.getCore().byId("MC_id_groupCustGst").setSelectedIndex(0);
                    }
                }
            },

            MC_onPressClose: function () {
                this.oManageCustomerDialog.close(); // Close the dialog
                this.byId("MC_id_CustTable").removeSelections(true); // Clear table selection
                this.MC_onTableSelectionChange(); // Update button states
                this.getView().setModel(new JSONModel({}), "CustomerModel"); // Clear CustomerModel data
            },

            onRadioButtonChange: function () {
                // Get selected index of the radio button group (0 = CGST/SGST, 1 = IGST)
                const isCGST = sap.ui.getCore().byId("MC_id_groupCustGst").getSelectedIndex() === 0;
                const model = this.getView().getModel("CustomerModel");
                // Set GST value and type based on selected option
                model.setProperty("/value", isCGST ? "9" : "18"); // 9% for CGST/SGST, 18% for IGST
                model.setProperty("/type", isCGST ? "CGST/SGST" : "IGST");
            },

            // Call the function for create new Customer
            MC_onAddCustomerDetails: function () {
                this.getView().getModel("ViewModel").setProperty("/update", true);
                this.manageCustomerDetails(false, true);
            },

            // Call the function for edit Customer
            MC_onEditCustomerDetails: function () {
                this.getView().getModel("ViewModel").setProperty("/update", false);
                this.manageCustomerDetails(true, false);
            },

            // Validate Common Fields on Input
            MC_ValidateCommonFields: function (oEvent) {
                var oInput = oEvent.getSource();
                utils._LCvalidateMandatoryField(oEvent);
                if (oInput.getValue() === "") oInput.setValueState("None"); // Clear error state on empty input
            },

            MC_LCvalidateName: function (oEvent) {
                var oInput = oEvent.getSource();
                utils._LCvalidateName(oEvent);
                if (oInput.getValue() === "") oInput.setValueState("None"); // Clear error state on empty input
            },

            // Validate LUT Number on Input
            MC_ValidateLUTNo: function (oEvent) {
                var oInput = oEvent.getSource();
                utils._LCvalidateLutNumber(oEvent);
                if (oInput.getValue() === "") oInput.setValueState("None"); // Clear error state on empty input
            },

            // Validate STDCode on Input
            MC_ValidateComboBox: function (oEvent) {
                var oInput = oEvent.getSource();
                utils._LCstrictValidationComboBox(oEvent);
                if (oInput.getValue() === "") oInput.setValueState("None"); // Clear error state on empty input
            },

            // Validate GST Number on Input
            MC_ValidateGstNumber: function (oEvent) {
                const oInput = sap.ui.getCore().byId("MC_id_CustomGst");
                const sInputValue = oInput.getValue();
                const dataModel = this.getView().getModel("CustomerModel");
                const visiModel = this.getView().getModel("visiblePlay");

                // GST regex
                const testPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{1}Z[0-9A-Z]{1}$/;

                if (testPattern.test(sInputValue) && sInputValue) {
                    visiModel.setProperty("/CC_id_CustInput", true);

                    // Extract first 2 digits (state code)
                    const stateCode = sInputValue.substring(0, 2);

                    // If state code is 29 (Karnataka)
                    if (stateCode === "29") {
                        sap.ui.getCore().byId("MC_id_groupCustGst").setSelectedIndex(0);
                        // visiModel.setProperty("/isRadioEditable", false); // Make radios non-editable
                        dataModel.setProperty("/value", "9");
                        dataModel.setProperty("/type", "CGST/SGST");
                    } else {
                        sap.ui.getCore().byId("MC_id_groupCustGst").setSelectedIndex(1);
                        // visiModel.setProperty("/isRadioEditable", false); // Allow change
                        // visiModel.setProperty("/isRadioEditable", false); // Make radios non-editable
                        dataModel.setProperty("/value", "18");
                        dataModel.setProperty("/type", "IGST");
                    }
                    oInput.setValueState("None");
                } else if (!sInputValue) {
                    // Empty input
                    dataModel.setProperty("/value", "0");
                    dataModel.setProperty("/type", "");
                    oInput.setValueState("None");
                    visiModel.setProperty("/CC_id_CustInput", false);
                    // visiModel.setProperty("/isRadioEditable", true);
                } else {
                    // Invalid GST
                    visiModel.setProperty("/CC_id_CustInput", false);
                    oInput.setValueState("Error");
                    oInput.setValueStateText(this.i18nModel.getText("gstNoValueState"));
                    // visiModel.setProperty("/isRadioEditable", true);
                }
            },

            // Validate Mobile Number on Input
            MC_ValidateMobileNo: function (oEventOrControl) {
                const oInput = oEventOrControl.getSource ? oEventOrControl.getSource() : oEventOrControl;
                var sValue = oInput.getValue()
                if (/[^0-9]/.test(sValue)) {
                    sValue = sValue.replace(/[^0-9]/g, ""); // remove all non-numeric chars
                    oInput.setValue(sValue); // reset value without alphabets
                }
                const sCountryName = this.getView().getModel("CustomerModel").getProperty("/country");
                const maxLength = oInput.getMaxLength();
                oInput.setValueState(sap.ui.core.ValueState.None);
                oInput.setValueStateText("");
                if (!/^\d*$/.test(sValue)) { // only digits
                    oInput.setValueState(sap.ui.core.ValueState.Error);
                    oInput.setValueStateText("Only numbers are allowed");
                    return false;
                }
                if (sValue.startsWith("0")) { // cannot start with 0
                    oInput.setValueState(sap.ui.core.ValueState.Error);
                    oInput.setValueStateText("Mobile Number cannot begin with 0");
                    return false;
                }
                if (sCountryName === "India") { // separate India vs Others
                    if (sValue.length !== 10) {
                        oInput.setValueState(sap.ui.core.ValueState.Error);
                        oInput.setValueStateText("Mobile Number must be exactly 10 digits long");
                        return false;
                    }
                } else {
                    if (sValue.length < 4 || sValue.length > maxLength) {
                        oInput.setValueState(sap.ui.core.ValueState.Error);
                        oInput.setValueStateText("Enter a valid mobile number (between 4-" + maxLength + " digits)");
                        return false;
                    }
                }
                return true;
            },

            // Validate PAN Card on Input
            MC_ValidatePanCard: function (oEvent) {
                var oInput = oEvent.getSource();
                utils._LCvalidateMandatoryField(oEvent);
                if (oInput.getValue() === "") oInput.setValueState("None"); // Clear error state on empty input
            },

            // Validate Email on Input
            MC_ValidateEmail: function (oEvent) {
                var oInput = oEvent.getSource();
                utils._LCvalidateEmail(oEvent);
                if (oInput.getValue() === "") oInput.setValueState("None"); // Clear error state on empty input
            },

            MC_validateCombobox: function (oEvent) {
                utils._LCstrictValidationComboBox(oEvent, "oEvent");
            },

            MC_onChangeCountry: function (oEvent) {
                utils._LCstrictValidationComboBox(oEvent, "oEvent");
                const oSelectedItem = oEvent.getSource().getSelectedItem();
                const oStateCombo = sap.ui.getCore().byId("MC_id_State");
                const oCityCombo = sap.ui.getCore().byId("MC_id_City");
                const oStdCodeInp = sap.ui.getCore().byId("MC_id_codeModel");
                const oModel = this.getView().getModel("CustomerModel");

                // Reset dependent fields
                oStateCombo.setSelectedKey("");
                oStateCombo.getBinding("items")?.filter([]);
                oCityCombo.setSelectedKey("");
                oCityCombo.getBinding("items")?.filter([]);
                oStdCodeInp.setValue("");

                if (!oSelectedItem) {
                    // reset model
                    oModel.setProperty("/country", "");
                    oModel.setProperty("/state", "");
                    oModel.setProperty("/baseLocation", "");
                    oModel.setProperty("/stdCode", "");
                } else {
                    // fetch country data
                    const sCountryCode = oSelectedItem.getAdditionalText(); // "IN"
                    const oCountryData = oSelectedItem.getBindingContext("CountryModel").getObject();
                    const sCountryName = oSelectedItem.getText();

                    // filter states by countryCode
                    oStateCombo.getBinding("items")?.filter([
                        new sap.ui.model.Filter("countryCode", sap.ui.model.FilterOperator.EQ, sCountryCode)
                    ]);

                    // set model props
                    oModel.setProperty("/country", sCountryName || "");
                    oModel.setProperty("/stdCode", oCountryData?.stdCode || "");

                    // reflect in UI
                    oStdCodeInp.setValue(oCountryData?.stdCode || "");
                }
                this._setMobileMaxLength();
            },

            _setMobileMaxLength: function () {
                const oModel = this.getView().getModel("CustomerModel");
                const sCountry = oModel.getProperty("/country");
                const oMobileInput = sap.ui.getCore().byId("MC_id_CustMob");
                if (sCountry === "India") {
                    oMobileInput.setMaxLength(10);
                } else {
                    oMobileInput.setMaxLength(20);
                }
            },

            MC_onChangeState: function (oEvent) {
                utils._LCstrictValidationComboBox(oEvent, "oEvent");
                const oSelectedItem = oEvent.getSource().getSelectedItem();

                const oCityCombo = sap.ui.getCore().byId("MC_id_City");  // Controls
                const oCountryCB = sap.ui.getCore().byId("MC_id_Country");
                const oModel = this.getView().getModel("CustomerModel");

                // Clear cities
                oCityCombo.setSelectedKey("");
                oCityCombo.getBinding("items")?.filter([]);

                if (!oSelectedItem) {
                    oModel.setProperty("/state", "");
                    oModel.setProperty("/baseLocation", "");
                } else {
                    const sStateName = oSelectedItem.getKey() || oSelectedItem.getText();
                    const sCountryCode = oCountryCB.getSelectedItem()?.getAdditionalText();

                    // filter cities based on state + country
                    oCityCombo.getBinding("items")?.filter([
                        new sap.ui.model.Filter("stateName", sap.ui.model.FilterOperator.EQ, sStateName),
                        new sap.ui.model.Filter("countryCode", sap.ui.model.FilterOperator.EQ, sCountryCode)
                    ]);
                    oModel.setProperty("/state", sStateName || "");
                }
            },

            MC_onChangeCity: function (oEvent) {
                utils._LCstrictValidationComboBox(oEvent, "oEvent");
                const oSelectedItem = oEvent.getSource().getSelectedItem();
                const oModel = this.getView().getModel("CustomerModel");

                if (!oSelectedItem) {
                    oModel.setProperty("/baseLocation", "");
                } else {
                    const sCityName = oSelectedItem.getKey() || oSelectedItem.getText();
                    oModel.setProperty("/baseLocation", sCityName || "");
                }
            },

            MC_OnPressMSASOW: function () {
               this.getRouter().navTo("RouteMSA",{
                    value: "MSA",
                    from:"ManageCustomer"
                }); // Navigate to MSASOW page
            },

            // Submit Customer Data
            MC_onPressSubmit: async function () {
                var that = this;
                try {
                    // Validate Mandatory Fields
                    var isMandatoryValid = (
                        utils._LCvalidateMandatoryField(sap.ui.getCore().byId("MC_id_CustCompanyName"), "ID") &&
                        // utils._LCvalidateMandatoryField(sap.ui.getCore().byId("MC_id_ComapnyCode"), "ID") &&
                        utils._LCvalidateMandatoryField(sap.ui.getCore().byId("MC_id_CustCustomerName"), "ID") &&
                        utils._LCvalidateMandatoryField(sap.ui.getCore().byId("MC_id_HeadPosition"), "ID") &&
                        utils._LCvalidateEmail(sap.ui.getCore().byId("MC_id_CustMail"), "ID") &&
                        utils._LCvalidateEmail(sap.ui.getCore().byId("MC_id_FinanceEmail"), "ID") &&
                        utils._LCstrictValidationComboBox(sap.ui.getCore().byId("MC_id_Country"), "ID") &&
                        utils._LCstrictValidationComboBox(sap.ui.getCore().byId("MC_id_State"), "ID") &&
                        utils._LCstrictValidationComboBox(sap.ui.getCore().byId("MC_id_City"), "ID") &&
                        utils._LCvalidateMandatoryField(sap.ui.getCore().byId("MC_id_CustAddress"), "ID")
                    );
                    if (!isMandatoryValid) {
                        MessageToast.show(this.i18nModel.getText("mandetoryFields"));
                        return;
                    }

                    var oData = this.getView().getModel("CustomerModel").getData();
                    var isValid = true;
                    // Optional Field Validations
                    if (oData.PAN && !utils._LCvalidateMandatoryField(sap.ui.getCore().byId("MC_id_CustomPan"), "ID")) isValid = false;
                    if (oData.GST && !utils._LCvalidateGstNumber(sap.ui.getCore().byId("MC_id_CustomGst"), "ID")) isValid = false;
                    if (oData.mobileNo && !this.MC_ValidateMobileNo(sap.ui.getCore().byId("MC_id_CustMob"))) isValid = false;
                    if (oData.LUT && !utils._LCvalidateLutNumber(sap.ui.getCore().byId("MC_id_LUTNo"), "ID")) isValid = false;
                    if (!isValid) {
                        MessageToast.show(this.i18nModel.getText("mandetoryChecks"));
                        return;
                    }
                    this.getBusyDialog(); // Show busy dialog 
                    // Submit data 
                    await this.ajaxCreateWithJQuery("ManageCustomer", {
                        data: oData
                    }).then(function (response) {
                        if (response && response.success === true) {
                            MessageToast.show(this.i18nModel.getText("msgCustomer3"));
                            this.getView().setModel(new JSONModel({}), "CustomerModel"); // Clear CustomerModel data
                            this.oManageCustomerDialog.close();
                            return this.readCallForManageCustomer("Initial");
                        } else {
                            MessageToast.show(this.i18nModel.getText("mandetoryFields"));
                        }
                    }.bind(this))
                        .then(function () {
                            that.closeBusyDialog();
                        }).catch(function (error) {
                            that.closeBusyDialog();
                            MessageToast.show(error.message || error.responseText);
                        }.bind(this));
                } catch (error) {
                    that.closeBusyDialog();
                    MessageToast.show(error.message || error.responseText);
                }
            },

            // Save Edited Customer
            MC_onPressSave: async function () {
                var that = this;
                try {
                    // Validate Mandatory Fields
                    var isMandatoryValid = (
                        utils._LCvalidateMandatoryField(sap.ui.getCore().byId("MC_id_CustCompanyName"), "ID") &&
                        utils._LCvalidateMandatoryField(sap.ui.getCore().byId("MC_id_CustCustomerName"), "ID") &&
                        utils._LCvalidateMandatoryField(sap.ui.getCore().byId("MC_id_HeadPosition"), "ID") &&
                        utils._LCvalidateEmail(sap.ui.getCore().byId("MC_id_CustMail"), "ID") &&
                        utils._LCvalidateEmail(sap.ui.getCore().byId("MC_id_FinanceEmail"), "ID") &&
                        utils._LCstrictValidationComboBox(sap.ui.getCore().byId("MC_id_Country"), "ID") &&
                        utils._LCstrictValidationComboBox(sap.ui.getCore().byId("MC_id_State"), "ID") &&
                        utils._LCvalidateMandatoryField(sap.ui.getCore().byId("MC_id_City"), "ID") &&
                        utils._LCvalidateMandatoryField(sap.ui.getCore().byId("MC_id_CustAddress"), "ID")
                    );
                    if (!isMandatoryValid) {
                        MessageToast.show(this.i18nModel.getText("mandetoryFields"));
                        return;
                    }
                    var oCustomerModel = this.getView().getModel("CustomerModel");
                    var oUpdatedData = oCustomerModel.getData();
                    delete oUpdatedData.currency; // Remove currency for update
                    var oTable = this.byId("MC_id_CustTable");
                    var oSelectedItem = oTable.getSelectedItem();
                    // Ensure a customer is selected
                    if (!oSelectedItem) {
                        MessageToast.show(this.i18nModel.getText("selectCustomerToUpdate"));
                        return;
                    }
                    var sCustomerId = oSelectedItem.getBindingContext("CreateCustomerModel").getProperty("ID");
                    var isValid = true;
                    // Optional Field Validations
                    if (oUpdatedData.PAN && !utils._LCvalidateMandatoryField(sap.ui.getCore().byId("MC_id_CustomPan"), "ID")) isValid = false;
                    if (oUpdatedData.GST && !utils._LCvalidateGstNumber(sap.ui.getCore().byId("MC_id_CustomGst"), "ID")) isValid = false;
                    if (oUpdatedData.mobileNo && !this.MC_ValidateMobileNo(sap.ui.getCore().byId("MC_id_CustMob"))) isValid = false;
                    if (oUpdatedData.LUT && !utils._LCvalidateLutNumber(sap.ui.getCore().byId("MC_id_LUTNo"), "ID")) isValid = false;
                    // Check if any mandatory fields are invalid
                    if (!isValid) {
                        MessageToast.show(this.i18nModel.getText("mandetoryChecks"));
                        return;
                    }
                    this.getBusyDialog(); // Show busy dialog
                    // Send update request
                    var requestData = {
                        filters: {
                            ID: sCustomerId
                        },
                        data: oUpdatedData
                    };
                    await this.ajaxUpdateWithJQuery("/ManageCustomer", requestData).then(function (response) {
                        if (response.success === true) {
                            oTable.removeSelections(true);
                            this.oManageCustomerDialog.close();
                            this.getView().setModel(new JSONModel({}), "CustomerModel"); // Clear CustomerModel data
                            MessageToast.show(this.i18nModel.getText("msgCustomer4"));
                            this.MC_onTableSelectionChange();
                            return this.MC_onSearch();
                        } else {
                            MessageToast.show(this.i18nModel.getText("mandetoryFields"));
                        }
                    }.bind(this))
                        .then(function () {
                            that.closeBusyDialog();
                        }).catch(function (error) {
                            that.closeBusyDialog();
                            MessageToast.show(error.message || error.responseText);
                        }.bind(this));
                } catch (error) {
                    this.closeBusyDialog();
                    MessageToast.show(error.message || error.responseText);
                }
            },

            // Delete Selected Customer
            MC_onDeleteAddCustomer: function () {
                var oTable = this.byId("MC_id_CustTable");
                var oSelectedItem = oTable.getSelectedItem();
                if (!oSelectedItem) {
                    MessageBox.error(this.i18nModel.getText("deleteCustomer"));
                    return;
                }
                var sCustomerID = oSelectedItem.getBindingContext("CreateCustomerModel").getProperty("ID");
                var that = this;
                this.showConfirmationDialog(this.i18nModel.getText("msgBoxConfirm"),
                    this.i18nModel.getText("confirmDeleteCustomerMessage"),
                    // onConfirm
                    function () {
                        that.ajaxDeleteWithJQuery("/ManageCustomer", {
                            filters: {
                                ID: sCustomerID
                            }
                        }).then(() => {
                            // Refresh the customer data after deletion
                            return that.readCallForManageCustomer("Initial");
                        }).then(() => {
                            that.closeBusyDialog();
                            MessageToast.show(that.i18nModel.getText("msgCustomerDeleteSuccess"));
                            that.byId("MC_id_AddCustomer").setEnabled(true);
                            oTable.removeSelections(true);
                            that.MC_onTableSelectionChange();
                        }).catch((error) => {
                            that.closeBusyDialog();
                            MessageToast.show(error.message || error.responseText);
                            oTable.removeSelections(true);
                        });
                    },
                    // onCancel
                    function () {
                        that.byId("MC_id_CustTable").removeSelections(true);
                        that.MC_onTableSelectionChange();
                    }
                );
            },

            // Clear Customer Form Selection
            MC_onClear: function () {
                var oComboBox = this.getView().byId("MC_id_CompanyName");
                if (oComboBox) oComboBox.setSelectedKey(""); // Clear combo box selection
            },

            MC_onSearch: async function () {
                var aFilterItems = this.byId("MC_id_CompanyFilter").getFilterGroupItems();
                var params = {};
                aFilterItems.forEach(function (oItem) {
                    var oControl = oItem.getControl();
                    if (oControl && oControl.getValue) {
                        var sKey = oItem.getName();
                        var sValue = oControl.getValue();
                        if (sValue) params[sKey] = sValue;
                    }
                });
                this.byId("MC_id_AddCustomer").setEnabled(true);
                this.getBusyDialog(); // Show busy dialog
                await this.readCallForManageCustomer(params).then(() => { }).catch((error) => {
                    MessageToast.show(error.message || error.responseText);
                }).finally(() => {
                    this.closeBusyDialog();
                });
            },

            readCallForManageCustomer: async function (filter) {
                this.getBusyDialog(); // <-- Open custom BusyDialog
                await this.ajaxReadWithJQuery("ManageCustomer", filter).then((oData) => {
                    var companyData = Array.isArray(oData.data) ? oData.data : [oData.data];
                    this.getOwnerComponent().setModel(new JSONModel(companyData), "CreateCustomerModel");
                    if (filter === "Initial") {
                        var customererData = [...new Map(companyData.filter(item => item.companyName).map(item => [item.companyName.trim(), item])).values()];
                        this.getView().setModel(new JSONModel(customererData), "CreateCustomerModelInitial");
                    }
                    this.closeBusyDialog(); // <-- Close custom BusyDialog
                }).catch((error) => {
                    sap.m.MessageToast.show(error.message || error.responseText);
                }).finally(() => {
                    this.closeBusyDialog(); // <-- Close custom BusyDialog
                });
            },

            // Handle Table Row Selection - Enable/Disable Buttons
            MC_onTableSelectionChange: function () {
                var aSelectedItems = this.byId("MC_id_CustTable").getSelectedItems();
                if (aSelectedItems.length > 0) {
                    this.byId("MC_id_AddCustomer").setEnabled(false);
                    this.byId("MC_id_EditCustomer").setEnabled(true);
                    this.byId("MC_id_DeleteCustomer").setEnabled(true);
                } else {
                    this.byId("MC_id_AddCustomer").setEnabled(true);
                    this.byId("MC_id_EditCustomer").setEnabled(true);
                    this.byId("MC_id_DeleteCustomer").setEnabled(true);
                }
            },

            onPressback: function () {
                this.getRouter().navTo("RouteTilePage"); // Navigate Back to Tile Page
            },

            onLogout: function () {
                this.CommonLogoutFunction(); // Navigate to Login Page
            },

            MC_DownloadTableData: function () {
                var table = this.byId("MC_id_CustTable");
                const oModelData = table.getModel("CreateCustomerModel").getData();
                const aFormattedData = oModelData.map(item => {
                    return {
                        ...item,
                    };
                });
                const aCols = [{
                    label: this.i18nModel.getText("companyname"),
                    property: "companyName",
                    type: "string"
                },
                {
                    label: this.i18nModel.getText("customerName"),
                    property: "name",
                    type: "string"
                },
                {
                    label: this.i18nModel.getText("gstNo"),
                    property: "GST",
                    type: "string"
                },
                {
                    label: this.i18nModel.getText("type"),
                    property: "type",
                    type: "string"
                },
                {
                    label: this.i18nModel.getText("percentage"),
                    property: "value",
                    type: "string"
                },
                {
                    label: this.i18nModel.getText("email"),
                    property: "customerEmail",
                    type: "string "
                },
                {
                    label: this.i18nModel.getText("mobileNo"),
                    property: "mobileNo",
                    type: "string"
                },
                ];
                const oSettings = {
                    workbook: {
                        columns: aCols,
                        context: {
                            sheetName: this.i18nModel.getText("managecustomerdetails")
                        }
                    },
                    dataSource: aFormattedData,
                    fileName: "Manage_Customer_Details.xlsx"
                };
                const oSheet = new Spreadsheet(oSettings);
                oSheet.build().then(function () {
                    MessageToast.show(this.i18nModel.getText("downloadsuccessfully"));
                }.bind(this)).finally(function () {
                    oSheet.destroy();
                });
            }
        });
    }
);