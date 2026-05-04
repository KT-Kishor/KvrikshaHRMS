sap.ui.define([
    "./BaseController", "../utils/validation", "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "../utils/CommonJsPDF",
    "../model/formatter",
],
    function (BaseController, utils, JSONModel, MessageToast, MessageBox, jsPDF, Formatter) {
        "use strict";
        return BaseController.extend("sap.kt.com.minihrsolution.controller.EmployeeOfferDetails", {
            Formatter: Formatter,
            onInit: function () {
                this.getRouter().getRoute("RouteEmployeeOfferDetails").attachMatched(this._onRouteMatched, this);
            },
            _onRouteMatched: async function (oEvent) {
                var LoginFunction = await this.commonLoginFunction("EmployeeOffer");
                if (!LoginFunction) return;
                this.getBusyDialog();
                this.byId("EOD_id_Joindate").setMinDate(new Date());
                this.sArgPara = oEvent.getParameter("arguments").sParOffer
                this.sSalutationArg = oEvent.getParameter("arguments").sParEmployee;
                this.byId("EOD_id_Wizard").getSteps()[0].setValidated(false);
                this.getView().byId("EOD_id_BondCombo").setVisible(false);
                this.getView().byId("EOD_id_Lyear").setVisible(false);
                this.i18nModel = this.getView().getModel("i18n").getResourceBundle();
                let oModel = this.getView().getModel("BaseLocationModel");
                let aData = oModel.getData();
                // Sort by city name
                aData.sort((a, b) => a.city.localeCompare(b.city));
                // Update the model with sorted data
                oModel.setData(aData);
                this._fetchCommonData("EmailContent", "CCMailModel TraineeFlag", { Type: "EmployeeOffer", Action: "CC" }); //CC mail id get call

                var jsonData = {
                    "Salutation": "Mr.",
                    "ConsultantName": "",
                    "CompanyCode":"",
                    "ConsultantAddress": "",
                    "Gender": "",
                    "Designation": "",
                    "OfferReleaseDate": this.Formatter.formatDate(new Date()),
                    "JoiningDate": "",
                    "CTC": "",
                    "EmploymentBond": "",
                    "JoiningBonus": "0",
                    "Country": "",
                    "CountryCode": "IN",
                    "State": "",
                    "BaseLocation": "",
                    "BasicSalary": "",
                    "HRA": "",
                    "IncomeTax": "",
                    "EmployeePF": "",
                    "EmployerPF": "",
                    "TotalDeduction": "",
                    "NoticePeriod": "",
                    "MedicalInsurance": "",
                    "Gratuity": "",
                    "CostofCompany": "",
                    "Total": "",
                    "Status": "",
                    "Currency": "INR",
                    "EmployeeEmail": "",
                    "PinCode": "",
                    "Department": "",
                    "VariablePay": "",
                    "VariablePercentage": "10"
                }
                this.getView().setModel(new JSONModel(jsonData), "employeeModel");
                var oViewModel = new JSONModel({ isEditMode: true, isVisiable: true, editable: false, pfVisibility: false, });
                this.getView().setModel(oViewModel, "viewModel");
                ["EOD_id_Name", "EOD_id_Reldate", "EOUF_id_Reldate", "EOUF_id_Name", "EOD_id_mail", "EOD_id_Location", "EOD_id_Country", "EOD_id_State", "EOUF_id_mail", "EOUF_id_Address", "EOD_id_Address", "EOD_id_CTC", "EOUF_id_CTC", "EOUF_id_Bonus", "EOD_id_Bonus", "EOD_id_VariablePay", "EOUF_id_VariablePerc", "EOD_id_PinCode", "EOUF_id_PinCode", "EOUF_id_Location", "EOUF_id_Country", "EOUF_id_State", "EOUF_id_Designation", "EOD_id_Designation", "EOD_id_CompanyCode", "EOUF_id_CompanyCode"].forEach(function (ids) {
                    this.getView().byId(ids).setValueState("None");
                }.bind(this));
                //create case
                if ((this.sArgPara === "CreateOfferFlag" && this.sArgPara !== "Recruitment") || (this.sSalutationArg !== "UpdateOffer" && this.sArgPara !== "Recruitment")) {
                    this._TDSslabCall("IN");
                    var createPage = true, updatePage = false;
                    if (this.sArgPara !== "CreateOfferFlag") {
                        this.getView().getModel("employeeModel").setProperty("/ConsultantName", this.sArgPara);
                        this.getView().getModel("employeeModel").setProperty("/Salutation", this.sSalutationArg);
                        // this.getView().getModel("employeeModel").setProperty("/Country", "India");
                    }
                    this.EOD_onResetWizard(); // reset wizard 
                    //update case
                } else if (this.sArgPara === "Recruitment" && this.sSalutationArg) {
                    // Fetch all JobApplications
                    await this._fetchCommonData("JobApplications", "recuritModel", {});
                    var allData = this.getView().getModel("recuritModel").getData() || [];
                    // Find the candidate by ID
                    var recruitmentData = allData.find(item => item.ID == this.sSalutationArg) || {};
                    // Map fields as needed
                    var mappedData = {
                        ConsultantName: recruitmentData.FullName || "",
                        ConsultantAddress: recruitmentData.Address || "",
                        Gender: recruitmentData.Gender || "",
                        Country: recruitmentData.Country || "India",
                        CountryCode: recruitmentData.CountryCode || "IN",
                        BaseLocation: recruitmentData.City || "Kalaburagi",
                        EmployeeEmail: recruitmentData.Email || "",
                        ConsultantAddress: recruitmentData.Address || "",
                    };
                    this.getView().getModel("employeeModel").setData(mappedData);
                } else {
                    var createPage = false, updatePage = true;
                    var oBasicDetailsSection = this.getView().byId("EODF_id_BasicDetailsSection");
                    this.getView().byId("EODF_id_ObjectPageLayoutEmp").setSelectedSection(oBasicDetailsSection);
                    this.readCallForEmployeeOffer(this.sArgPara);
                }
                this.closeBusyDialog();
                this.getView().byId("EOD_id_PageCrate").setVisible(createPage); // create page visibility
                this.getView().byId("EODF_id_PageUpdate").setVisible(updatePage); // update page visibilty
                this.getView().byId("EOD_id_Submit").setEnabled(false);
                this._makeDatePickersReadOnly(["EOD_id_Reldate", "EOD_id_Joindate", "EOUF_id_Reldate", "EOUF_id_Joindate"]); // make date only read only
                const salutation = this.getView().getModel("employeeModel").getProperty("/Salutation");
                if (salutation === "Dr.") {
                    this.getView().byId("EOD_id_Gender").setEnabled(true);
                } else if (salutation === "Ms." || salutation === "Mrs.") {
                    this.getView().getModel("employeeModel").setProperty("/Gender", "Female");
                }

                this.byId("EOD_id_CompanyCode").setSelectedKey("");
            },

            _applyCountryStateCityFilters: function () {
                const oModel     = this.getView().getModel("employeeModel");
                const oCountryCB = this.byId("EOUF_id_Country");
                const oStateCB   = this.byId("EOUF_id_State");
                const oSourceCB  = this.byId("EOUF_id_Location");

                const sCountry   = oModel.getProperty("/Country");      // e.g. "Australia"
                const sState     = oModel.getProperty("/State");        // e.g. "Queensland"
                const sSource    = oModel.getProperty("/BaseLocation"); // e.g. "Bongaree"

                // Get bindings safely
                const oStateBinding  = oStateCB?.getBinding("items");
                const oSourceBinding = oSourceCB?.getBinding("items");

                // Reset filters if bindings exist
                if (oStateBinding) {
                    oStateBinding.filter([]);
                }
                if (oSourceBinding) {
                    oSourceBinding.filter([]);
                }

                if (sCountry) {
                    const aCountryData = this.getView().getModel("CountryModel")?.getData() || [];
                    const oCountryObj = aCountryData.find(c => c.countryName === sCountry);

                    if (oCountryObj) {
                        const sCountryCode = oCountryObj.code; 

                        // Filter States by CountryCode
                        if (oStateBinding) {
                            oStateBinding.filter([
                                new sap.ui.model.Filter("countryCode", sap.ui.model.FilterOperator.EQ, sCountryCode)
                            ]);
                        }

                        // Filter Cities by State + CountryCode
                        if (sState && oSourceBinding) {
                            oSourceBinding.filter([
                                new sap.ui.model.Filter("stateName", sap.ui.model.FilterOperator.EQ, sState),
                                new sap.ui.model.Filter("countryCode", sap.ui.model.FilterOperator.EQ, sCountryCode)
                            ]);
                        }
                    }
                }

                // Restore selection back in UI
                if (oCountryCB) {
                    oCountryCB.setSelectedKey(sCountry || "");
                }
                if (oStateCB) {
                    oStateCB.setSelectedKey(sState || "");
                }
                if (oSourceCB) {
                    oSourceCB.setSelectedKey(sSource || "");
                }
            },

            onLogout: function () {
                this.CommonLogoutFunction();
            },

            //Edit or save in update case
            EOUF_onEditOrSavePress: function () {
                var oViewModel = this.getView().getModel("viewModel");
                // Check if in edit mode
                if (oViewModel.getProperty("/editable")) {
                    var isValid = utils._LCstrictValidationComboBox(this.getView().byId("EOUF_id_CompanyCode"), "ID") && utils._LCvalidateName(this.getView().byId("EOUF_id_Name"), "ID") && utils._LCvalidateDate(this.getView().byId("EOUF_id_Reldate"), "ID") && utils._LCvalidateDate(this.getView().byId("EOUF_id_Joindate"), "ID") && utils._LCstrictValidationComboBox(this.getView().byId("EOUF_id_Designation"), "ID") && utils._LCstrictValidationComboBox(this.getView().byId("EOUF_id_Country"), "ID") && utils._LCvalidateMandatoryField(this.getView().byId("EOUF_id_Location"), "ID") &&
                        utils._LCvalidateEmail(this.getView().byId("EOUF_id_mail"), "ID") && utils._LCvalidateMandatoryField(this.getView().byId("EOUF_id_Address"), "ID") && utils._LCvalidatePinCode(this.getView().byId("EOUF_id_PinCode"), "ID") && utils._LCvalidateCTC(this.getView().byId("EOUF_id_CTC"), "ID") && utils._LCvalidateJoiningBonus(this.getView().byId("EOUF_id_Bonus"), "ID") && utils._LCvalidateVariablePay(this.getView().byId("EOUF_id_VariablePerc"), "ID");
                    // Save the changes
                    if (isValid) {
                        this.updateCallForEmployeeOffer(oViewModel, "offerUpdateSucc");
                    }
                    else {
                        MessageToast.show(this.i18nModel.getText("mandetoryFields"));
                    }
                } else {
                    // Enable edit mode and make CTC field visible
                    oViewModel.setProperty("/editable", true);
                    oViewModel.setProperty("/isEditMode", false);
                    oViewModel.setProperty("/isCTCVisible", true);
                }
            },
            //Navigate back to offer view
            EOD_onPressBack: function () {
                var oViewModel = this.getView().getModel("viewModel");
                // Check if in edit mode
                if (oViewModel.getProperty("/editable")) {
                    // Show confirmation dialog before navigating
                    this.showConfirmationDialog(
                        this.i18nModel.getText("ConfirmActionTitle"),
                        this.i18nModel.getText("backConfirmation"),
                        function () {
                            oViewModel.setProperty("/editable", false);
                            oViewModel.setProperty("/isEditMode", true);
                            this.getRouter().navTo("RouteEmployeeOffer", { valueEmp: "EmployeeOfferDetails", from: "EmployeeOfferDetails" });
                        }.bind(this),
                    );
                } else {
                    this.getRouter().navTo("RouteEmployeeOffer", { valueEmp: "EmployeeOfferDetails", from: "EmployeeOfferDetails" });
                }
            },

            _TDSslabCall: async function (code, id) {
                try {
                    if (id) id.setBusy(true), id.setValue("");
                    await this._fetchCommonData("TaxCalculation", "TDSModel", { Country: code });
                    if (!this.getView().getModel("TDSModel") || this.getView().getModel("TDSModel").getData().length === 0) MessageBox.warning("TDS will be zero as Tax Calculation is not available for the selected country.");
                    if (id) id.setBusy(false);
                }
                catch (e) {
                    if (id) id.setBusy(false);
                    MessageToast.show(this.i18nModel.getText("commonErrorMessage"));
                }

            },

            //Update call 
            updateCallForEmployeeOffer: async function (oViewModel, text) {
                try {
                    this.getBusyDialog();
                    var oModel = this.getView().getModel("employeeModel").getData();
                    oModel.Status = oModel.Status === "Rejected" ? "Saved" : oModel.Status;
                    oModel.CountryCode = this.getView().byId("EOD_id_Country").getSelectedItem().getAdditionalText();
                    oModel.BranchCode = this.getView().byId("EOUF_id_CompanyCode").getSelectedItem().getAdditionalText();
                    oModel.JoiningDate = this.byId("EOUF_id_Joindate").getValue().split("/").reverse().join("-");
                    oModel.OfferReleaseDate = this.byId("EOUF_id_Reldate").getValue().split("/").reverse().join("-");
                    delete oModel.CityModel;
                    oModel = {
                        "data": oModel,
                        "filters": {
                            "ID": this.sArgPara
                        }
                    };
                    oModel.Department = this.getView().byId("EOUF_id_Designation").getSelectedItem().getAdditionalText();
                    await this.ajaxUpdateWithJQuery("EmployeeOffer", oModel).then((oData) => {
                        if (oData.success) {
                            this.closeBusyDialog();
                            oViewModel.setProperty("/editable", false);
                            oViewModel.setProperty("/isEditMode", true);
                            oViewModel.setProperty("editBut", true);
                            oViewModel.setProperty("/isVisiable", true);
                            oViewModel.setProperty("/isCTCVisible", false);
                            if (text && text !== "silent") {
                                MessageToast.show(this.i18nModel.getText(text));
                            }
                            this.getView().getModel("employeeModel").refresh(true);
                            // this.getView().getModel("CompanyCodeDetailsModel")?.refresh(true);
                        }
                    }).catch((err) => {
                        this.closeBusyDialog();
                        MessageToast.show(err.message || err.responseText);
                    });
                } catch (err) {
                    this.closeBusyDialog();
                    MessageToast.show(err.message || err.responseText);
                }
            },
            //Read call
            readCallForEmployeeOffer: async function (sArgPara) {
                var queryString = $.param({
                    "ID": sArgPara
                });
                await this.ajaxReadWithJQuery("EmployeeOffer", queryString).then((oData) => {
                    var offerData = Array.isArray(oData.data) ? oData.data : [oData.data];
                    var index = offerData[0].EmployeePF !== "0" ? 1 : 0;
                    this.byId("EOUF_id_RadioButTds").setSelectedIndex(index);
                    if (index === 1) this.getView().getModel("viewModel").setProperty("/pfVisiblity", true);
                    else this.getView().getModel("viewModel").setProperty("/pfVisiblity", false);
                    this.getView().setModel(new JSONModel(offerData[0]), "employeeModel");
                    this._applyCountryStateCityFilters();
                    var oViewModel = this.getView().getModel("viewModel");
                    this.byId("EOUF_id_Joindate").setMinDate(new Date(offerData[0].OfferReleaseDate));
                    this._TDSslabCall(offerData[0].CountryCode);
                    if (offerData[0].Status === "Onboarded") {
                        oViewModel.setProperty("/isVisiable", false);
                        oViewModel.setProperty("/ediBut", false);
                    } else if (offerData[0].Status === "Rejected") {
                        oViewModel.setProperty("/isVisiable", false);
                        oViewModel.setProperty("/ediBut", true);
                    } else if (offerData[0].Status === "Saved") {
                        oViewModel.setProperty("/isVisiable", true);
                        oViewModel.setProperty("editBut", true);
                    }
                    if (this.getView().getModel("employeeModel").getProperty("/Salutation") === "Dr.") {
                        this.getView().byId("EOU_id_Gender").setEnabled(true);
                    }
                    else {
                        this.getView().byId("EOU_id_Gender").setEnabled(false);
                    }
                    this.closeBusyDialog();
                }).catch((error) => {
                    this.closeBusyDialog();
                    MessageToast.show(error.responseText);
                })
            },
            //Validate name
            EOD_validateName: function (oEvent) {
                utils._LCvalidateName(oEvent);
                this.EOD_validateStep();
            },
            //Validate email
            EOD_validateEmail: function (oEvent) {
                utils._LCvalidateEmail(oEvent);
                this.EOD_validateStep();
            },
            //validate pincode
            EOD_validatePinCode: function (oEvent) {
                utils._LCvalidatePinCode(oEvent);
                this.EOD_validateStep();
            },
            //validate amount
            EOD_validateAmount: function (oEvent) {
                utils._LCvalidateCTC(oEvent);
                this.EOD_validateStep();
                this.EOD_onTDSCheckboxChange();
            },
            //validate joining bonus
            EOD_validateJoiningBonus: function (oEvent) {
                utils._LCvalidateJoiningBonus(oEvent);
                this.EOD_validateStep();
            },
            EOD_onChangeCountry: function (oEvent) {
                utils._LCstrictValidationComboBox(oEvent, "oEvent");
                if (oEvent.getSource().getValue() === '') {
                    oEvent.getSource().setValueState("None")
                }
                var oValue = oEvent.getSource().getSelectedItem().getAdditionalText();
                this._TDSslabCall(oValue, this.getView().byId("EOD_id_CTC"));
                var oSelectedItem = oEvent.getSource().getSelectedItem();
                if (!oSelectedItem) return;
                var sCountryCode = oSelectedItem.getAdditionalText();
                var oStateCombo = this.byId("EOD_id_State");  // Filter States
                var oStateBinding = oStateCombo.getBinding("items");
                oStateBinding.filter(new sap.ui.model.Filter("countryCode", sap.ui.model.FilterOperator.EQ, sCountryCode));
                oStateCombo.setSelectedKey(""); // Reset state selection
                var oCityCombo = this.byId("EOD_id_Location"); // Clear city
                oCityCombo.getBinding("items").filter([]);
                oCityCombo.setSelectedKey("");
                this.EOD_validateStep();
            },
            EOD_onChangeState: function (oEvent) {
                utils._LCstrictValidationComboBox(oEvent, "oEvent");

                if (oEvent.getSource().getValue() === '') {
                    oEvent.getSource().setValueState("None")
                }
                var oSelectedItem = oEvent.getSource().getSelectedItem();
                if (!oSelectedItem) return;
                var sStateName = oSelectedItem.getAdditionalText() || oSelectedItem.getKey();
                var sCountryCode = this.byId("EOD_id_Country").getSelectedItem().getAdditionalText();
                var oCityCombo = this.byId("EOD_id_Location");   // Filter Cities
                var oCityBinding = oCityCombo.getBinding("items");
                oCityBinding.filter([
                    new sap.ui.model.Filter("stateName", sap.ui.model.FilterOperator.EQ, sStateName),
                    new sap.ui.model.Filter("countryCode", sap.ui.model.FilterOperator.EQ, sCountryCode)
                ]);
                oCityCombo.setSelectedKey(""); // Reset city selection
                this.EOD_validateStep();
            },
            //validate combobox
            EOD_validateCombobox: function (oEvent) {
                utils._LCstrictValidationComboBox(oEvent);
                this.EOD_validateStep();
            },
            EOD_onCompanyCodeChange: function (oEvent) {
                this.onCompanyCodeChangeCommon(
                    oEvent,
                    "employeeModel",     // Model name
                    "/CompanyCode",        // Path to company code property
                    "/Branch",             // Path to branch property
                    "EOD_id_Branch"         // Branch control ID
                );
                utils._LCstrictValidationComboBox(oEvent);
                this.EOD_validateStep();
            },
            EU_onCompanyCodeChange: function (oEvent) {
                utils._LCstrictValidationComboBox(oEvent);
                this.onCompanyCodeChangeCommon(
                    oEvent,
                    "employeeModel",     // Model name
                    "/CompanyCode",        // Path to company code property
                    "/Branch",             // Path to branch property
                    "EOUF_id_Branch"         // Branch control ID
                );
            },
            //validate variable pay
            EOD_validatevariable: function (oEvent) {
                utils._LCvalidateVariablePay(oEvent);
                this.EOD_validateStep();
                this.EOD_onTDSCheckboxChange()
            },
            //validate date
            EOD_validateDate: function (oEvent) {
                utils._LCvalidateDate(oEvent); // Base validation
                this.EOD_validateStep(); // Step validation
                var oOfferDateId = oEvent.getSource().getId().split("--")[2];
                var releaseDate, joinDateVa;
                if (oOfferDateId === "EOD_id_Reldate" || oOfferDateId === "EOUF_id_Reldate") {
                    joinDateVa = oOfferDateId === "EOD_id_Reldate" ? "EOD_id_Joindate" : "EOUF_id_Joindate";
                    releaseDate = oEvent.getSource().getDateValue();
                    if (releaseDate) {
                        var oJoinDatePicker = this.byId(joinDateVa);
                        var joinDate = oJoinDatePicker.getDateValue();
                        oJoinDatePicker.setMinDate(releaseDate);
                        if (joinDate && joinDate < releaseDate) {
                            oJoinDatePicker.setValue("");
                            oJoinDatePicker.setValueState("Error");
                        } else {
                            oJoinDatePicker.setValueState("None");
                        }
                    }
                }
            },
            //validate common field
            EOD_ValidateCommonFields: function (oEvent) {
                utils._LCvalidateMandatoryField(oEvent);
                this.EOD_validateStep();
            },
            //Step validation
            EOD_validateStep: function () {
                // Check if all fields have values
                var allFieldsFilled = this.getView().byId("EOD_id_CompanyCode").getSelectedKey() && this.getView().byId("EOD_id_Name").getValue() && this.getView().byId("EOD_id_Reldate").getValue() && this.getView().byId("EOD_id_Designation").getSelectedKey() && this.getView().byId("EOD_id_Country").getSelectedKey() && this.getView().byId("EOD_id_State").getSelectedKey() && this.getView().byId("EOD_id_Location").getSelectedKey() && this.getView().byId("EOD_id_mail").getValue() && this.getView().byId("EOD_id_Address").getValue() && this.getView().byId("EOD_id_CTC").getValue() && this.getView().byId("EOD_id_Bonus").getValue() && this.getView().byId("EOD_id_VariablePay").getValue();
                if (allFieldsFilled) {
                    // Validate each field directly
                    let isValid = utils._LCstrictValidationComboBox(this.getView().byId("EOD_id_CompanyCode"), "ID") &&
                        utils._LCvalidateName(this.getView().byId("EOD_id_Name"), "ID") && utils._LCvalidateDate(this.getView().byId("EOD_id_Reldate"), "ID") && utils._LCvalidateDate(this.getView().byId("EOD_id_Joindate"), "ID") && utils._LCstrictValidationComboBox(this.getView().byId("EOD_id_Designation"), "ID") && utils._LCstrictValidationComboBox(this.getView().byId("EOD_id_Country"), "ID") && utils._LCstrictValidationComboBox(this.getView().byId("EOD_id_State"), "ID") && utils._LCstrictValidationComboBox(this.getView().byId("EOD_id_Location"), "ID") &&
                        utils._LCvalidateEmail(this.getView().byId("EOD_id_mail"), "ID") && utils._LCvalidateMandatoryField(this.getView().byId("EOD_id_Address"), "ID") && utils._LCvalidatePinCode(this.getView().byId("EOD_id_PinCode"), "ID") && utils._LCvalidateCTC(this.getView().byId("EOD_id_CTC"), "ID") && utils._LCvalidateJoiningBonus(this.getView().byId("EOD_id_Bonus"), "ID") && utils._LCvalidateVariablePay(this.getView().byId("EOD_id_VariablePay"), "ID");
                    this.byId("EOD_id_Wizard").getSteps()[0].setValidated(isValid);
                } else {
                    this.byId("EOD_id_Wizard").getSteps()[0].setValidated(false);
                    this.byId("EOD_id_WizardStep").getAggregation("_nextButton").setText(this.i18nModel.getText("next"));
                }
            },
            // Reset wizard to initial state
            EOD_onResetWizard: function () {
                this.closeBusyDialog();
                var oWizard = this.getView().byId("EOD_id_Wizard");
                oWizard.discardProgress(oWizard.getSteps()[0]); // Discard progress 
                oWizard.goToStep(oWizard.getSteps()[0]); // Go to the first step
                this.getView().byId("EOD_id_Bond").setSelectedIndex(1);
                this.getView().byId("EOUF_id_RadioButTds").setSelectedIndex(0);
            },
            //Submit the data
            EOD_onSubmitData: async function () {
                try {
                    if (utils._LCstrictValidationComboBox(this.getView().byId("EOD_id_CompanyCode"), "ID") && utils._LCvalidateName(this.getView().byId("EOD_id_Name"), "ID") && utils._LCvalidateDate(this.getView().byId("EOD_id_Reldate"), "ID") && utils._LCvalidateDate(this.getView().byId("EOD_id_Joindate"), "ID") && utils._LCstrictValidationComboBox(this.getView().byId("EOD_id_Designation"), "ID") && utils._LCstrictValidationComboBox(this.getView().byId("EOD_id_Country"), "ID") && utils._LCstrictValidationComboBox(this.getView().byId("EOD_id_State"), "ID") && utils._LCstrictValidationComboBox(this.getView().byId("EOD_id_Location"), "ID") &&
                        utils._LCvalidateEmail(this.getView().byId("EOD_id_mail"), "ID") && utils._LCvalidateMandatoryField(this.getView().byId("EOD_id_Address"), "ID") && utils._LCvalidatePinCode(this.getView().byId("EOD_id_PinCode"), "ID") && utils._LCvalidateCTC(this.getView().byId("EOD_id_CTC"), "ID") && utils._LCvalidateJoiningBonus(this.getView().byId("EOD_id_Bonus"), "ID") && utils._LCvalidateVariablePay(this.getView().byId("EOUF_id_VariablePerc"), "ID")) {
                        this.getBusyDialog();
                        var oModel = this.getView().getModel("employeeModel").getData();
                        oModel.Gender = this.getView().byId("EOD_id_Gender").getSelectedKey();
                        oModel.CountryCode = this.getView().byId("EOD_id_Country").getSelectedItem().getAdditionalText();
                        oModel.BranchCode = this.getView().byId("EOD_id_CompanyCode").getSelectedItem().getAdditionalText();
                        oModel.Department = this.getView().byId("EOD_id_Designation").getSelectedItem().getAdditionalText();
                        oModel.BaseLocation = oModel.BaseLocation !== "" ? oModel.BaseLocation : this.getView().byId("EOD_id_Location").getSelectedKey();
                        oModel.JoiningDate = oModel.JoiningDate.split("/").reverse().join("-");
                        oModel.OfferReleaseDate = oModel.OfferReleaseDate.split("/").reverse().join("-");
                        oModel.Status = "Saved";
                        delete oModel.CityModel;
                        oModel = {
                            "tableName": "Employeeoffer",
                            "data": oModel
                        };
                        await this.ajaxCreateWithJQuery("EmployeeOffer", oModel).then((oData) => {
                            if (oData.success) {
                                this.closeBusyDialog();
                                var oDialog = new sap.m.Dialog({
                                    title: this.i18nModel.getText("success"),
                                    type: sap.m.DialogType.Message,
                                    state: sap.ui.core.ValueState.Success,
                                    content: new sap.m.Text({ text: this.i18nModel.getText("offerSuccess") }),
                                    beginButton: new sap.m.Button({
                                        text: "OK",
                                        type: "Transparent",
                                        press: function () {
                                            oDialog.close();
                                            this.byId("EDO_id_WizardStepT").getParent().setShowNextButton(true);
                                            // this.getView().getModel("CompanyCodeDetailsModel")?.refresh(true);
                                            this.getRouter().navTo("RouteEmployeeOffer", { valueEmp: "EmployeeOffer", from: "EmployeeOfferDetails" });
                                        }.bind(this)
                                    }),
                                    endButton: new sap.m.Button({
                                        text: "Generate PDF",
                                        type: "Transparent",
                                        press: function () {
                                            this.EOUF_onPressMerge();
                                            var oUpdatePayload = {
                                                "data": { Status: "New" },
                                                "filters": { "ID": oData.ID }
                                            };

                                            this.ajaxUpdateWithJQuery("EmployeeOffer", oUpdatePayload).then((oData) => {
                                                this.closeBusyDialog();
                                                if (oData.success) {
                                                    oDialog.close();
                                                    MessageToast.show(this.i18nModel.getText("pdfSucces"));
                                                    this.byId("EDO_id_WizardStepT").getParent().setShowNextButton(true);
                                                    //  this.getView().getModel("CompanyCodeDetailsModel").refresh(true);
                                                    this.getRouter().navTo("RouteEmployeeOffer", { valueEmp: "EmployeeOffer", from: "EmployeeOfferDetails" });
                                                }
                                            }).catch((error) => {
                                                this.closeBusyDialog();
                                                MessageToast.show(error.responseText);
                                            });
                                        }.bind(this)
                                    }),
                                    afterClose: function () {
                                        oDialog.destroy();
                                    }
                                });
                                oDialog.open();
                            }
                        }).catch((error) => {
                            this.closeBusyDialog();
                            MessageToast.show(error.responseText);
                        });
                    } else {
                        MessageToast.show(this.i18nModel.getText("mandetoryFields"));
                    }

                } catch (error) {
                    this.closeBusyDialog();
                    MessageToast.show(this.i18nModel.getText("technicalError"));
                }
            },
            //visibility of bond dropdown
            EOD_onRadioButtonSelect: function (oEvent) {
                if (oEvent.getParameter("selectedIndex") === 0) var sValue = true;
                else var sValue = false;
                this.getView().byId("EOD_id_BondCombo").setVisible(sValue);
                this.getView().byId("EOD_id_Lyear").setVisible(sValue);
            },
            //TDS check box
            EOD_onTDSCheckboxChange: function () {
                var ID = (this.sArgPara === "CreateOfferFlag" || this.sSalutationArg !== "UpdateOffer") ? "EOD_id_RadioButTds" : "EOUF_id_RadioButTds";
                var oTdsVal = this.byId(ID).getAggregation("buttons")[this.byId(ID).getSelectedIndex()].getProperty("text");
                if (oTdsVal === "PF") this.getView().getModel("viewModel").setProperty("/pfVisiblity", true);
                else this.getView().getModel("viewModel").setProperty("/pfVisiblity", false);
                if (this.getView().getModel("employeeModel").getProperty("/CTC"))
                    this._calculateSalaryComponents(oTdsVal);
            },
            //Step two validation
            EOD_onStep2: function () {
                this.getView().byId("EOD_id_Submit").setEnabled(true);
                var oTdsVal = this.byId("EOD_id_RadioButTds").getAggregation("buttons")[this.byId("EOD_id_RadioButTds").getSelectedIndex()].getProperty("text");
                this._calculateSalaryComponents(oTdsVal);
                var oModel = this.getView().getModel("employeeModel").getData();
                if (oModel.BaseLocation === "") this.getView().getModel("employeeModel").setProperty("/BaseLocation", this.byId("EOD_id_Location").getSelectedKey())
                if (oModel.Designation === "") this.getView().getModel("employeeModel").setProperty("/Designation", this.byId("EOD_id_Designation").getSelectedKey())
                this.byId("EDO_id_WizardStepT").getParent().setShowNextButton(false);
            },
            //common dialog
            EOD_commonOpenDialog: function (fragmentName) {
                if (!this.EOU_oDialogMail) {
                    sap.ui.core.Fragment.load({
                        name: fragmentName,
                        controller: this,
                    }).then(function (EOU_oDialogMail) {
                        this.EOU_oDialogMail = EOU_oDialogMail;
                        this.getView().addDependent(this.EOU_oDialogMail);
                        this.EOU_oDialogMail.open();
                    }.bind(this));
                } else {
                    this.EOU_oDialogMail.open();
                }
            },
            //Send mail function
            EOUF_onSendEmail: function () {
                var oEmployeeEmail = this.getView().getModel("employeeModel").getData().EmployeeEmail;
                if (!oEmployeeEmail || oEmployeeEmail.length === 0) {
                    MessageBox.error("To Email is missing");
                    return;
                }
                var oUploaderDataModel = new JSONModel({
                    isEmailValid: true,
                    ToEmail: oEmployeeEmail,
                    CCEmail: this.getView().getModel("CCMailModel").getData()[0].CCEmailId,
                    name: "",
                    mimeType: "",
                    content: "",
                    isFileUploaded: false,
                    button: false
                });
                this.getView().setModel(oUploaderDataModel, "UploaderData");
                this.EOD_commonOpenDialog("sap.kt.com.minihrsolution.fragment.CommonMail");
                this.validateSendButton();
            },
            //close mail dialog
            Mail_onPressClose: function () {
                this.EOU_oDialogMail.destroy();
                this.EOU_oDialogMail = null;
            },
            //File upload function calling from base controller
            Mail_onUpload: function (oEvent) {
                this.handleFileUpload(
                    oEvent,
                    this,                      // context
                    "UploaderData",            // model name
                    "/attachments",            // path to attachment array
                    "/name",                   // path to comma-separated file names
                    "/isFileUploaded",         // boolean flag path
                    "uploadSuccessfull",       // i18n success key
                    "fileAlreadyUploaded",     // i18n duplicate key
                    "noFileSelected",          // i18n no file selected
                    "fileReadError",           // i18n file read error
                    () => this.validateSendButton()
                );
            },
            //Mail dialog button visibility
            validateSendButton: function () {
                try {
                    const sendBtn = sap.ui.getCore().byId("SendMail_Button");
                    const emailField = sap.ui.getCore().byId("CCMail_TextArea");
                    const emailFieldTo = sap.ui.getCore().byId("Mail_id_Text");
                    const uploaderModel = this.getView().getModel("UploaderData");
                    if (!sendBtn || !emailField || !uploaderModel || !emailFieldTo) {
                        return;
                    }
                    const isEmailValid = utils._LCvalidateEmail(emailField, "ID") === true;
                    const isEmailValidTo = utils._LCvalidateEmail(emailFieldTo, "ID") === true;
                    const isFileUploaded = uploaderModel.getProperty("/isFileUploaded") === true;
                    sendBtn.setEnabled(isEmailValid && isEmailValidTo && isFileUploaded);
                } catch (error) {
                    MessageToast.show(this.i18nModel.getText("technicalError"));
                }
            },

            //If mail changing then check validation
            Mail_onEmailChange: function () {
                this.validateSendButton();
            },
            //Send mail
            Mail_onSendEmail: function () {
                try {
                    var oModel = this.getView().getModel("employeeModel").getData();
                    var aAttachments = this.getView().getModel("UploaderData").getProperty("/attachments");
                    if (!aAttachments || aAttachments.length === 0) {
                        MessageToast.show(this.i18nModel.getText("attachmentRequired")); // Or a hardcoded string: "Please add at least one attachment."
                        return;
                    }
                    var oPayload = {
                        "EmployeeName": oModel.ConsultantName,
                        "toEmailID": oModel.EmployeeEmail,
                        "CC": sap.ui.getCore().byId("CCMail_TextArea").getValue(),
                        "attachments": this.getView().getModel("UploaderData").getProperty("/attachments"),
                        "Designation": oModel.Designation,
                        "EmploymentBond" : oModel.EmploymentBond
                    };
                    this.getBusyDialog();
                    this.ajaxCreateWithJQuery("EmployeeOfferEmail", oPayload).then((oData) => {
                        this.getView().getModel("employeeModel").setProperty("/Status", "Offer Sent");
                        this.updateCallForEmployeeOffer(this.getView().getModel("viewModel"), "silent");
                        MessageToast.show(this.i18nModel.getText("emailSuccess"));
                        this.closeBusyDialog();
                    }).catch((error) => {
                        this.closeBusyDialog();
                        MessageToast.show(error.responseText);
                    });
                    this.Mail_onPressClose();
                } catch (error) {
                    this.closeBusyDialog();
                    MessageToast.show(error.responseText);
                }
            },

            //back confirmation
            EOD_onPressBackBtn: function () {
                this.showConfirmationDialog(
                    this.i18nModel.getText("ConfirmActionTitle"),
                    this.i18nModel.getText("backConfirmation"),
                    function () {
                        this.getRouter().navTo("RouteEmployeeOffer", { valueEmp: "EmployeeOfferDetails", from: "EmployeeOfferDetails" });
                    }.bind(this)
                );
                this.byId("EDO_id_WizardStepT").getParent().setShowNextButton(true);
            },
            EUD_onChangeCountry: function (oEvent) {
                utils._LCstrictValidationComboBox(oEvent, "oEvent");
                if (oEvent.getSource().getValue() === '') {
                    oEvent.getSource().setValueState("None")
                }
                var oValue = oEvent.getSource().getSelectedItem().getAdditionalText();
                this._TDSslabCall(oValue, this.getView().byId("EOUF_id_CTC"));
                var oSelectedItem = oEvent.getSource().getSelectedItem();
                if (!oSelectedItem) return;
                var sCountryCode = oSelectedItem.getAdditionalText();
                var oStateCombo = this.byId("EOUF_id_State");  // Filter States
                var oStateBinding = oStateCombo.getBinding("items");
                oStateBinding.filter(new sap.ui.model.Filter("countryCode", sap.ui.model.FilterOperator.EQ, sCountryCode));
                oStateCombo.setSelectedKey(""); // Reset state selection
                var oCityCombo = this.byId("EOUF_id_Location"); // Clear city
                oCityCombo.getBinding("items").filter([]);
                oCityCombo.setSelectedKey("");
            },
            EUD_onChangeState: function (oEvent) {
                utils._LCstrictValidationComboBox(oEvent, "oEvent");
                if (oEvent.getSource().getValue() === '') {
                    oEvent.getSource().setValueState("None")
                }
                var oSelectedItem = oEvent.getSource().getSelectedItem();
                if (!oSelectedItem) return;
                var sStateName = oSelectedItem.getAdditionalText() || oSelectedItem.getKey();
                var sCountryCode = this.byId("EOUF_id_Country").getSelectedItem().getAdditionalText();
                var oCityCombo = this.byId("EOUF_id_Location");   // Filter Cities
                var oCityBinding = oCityCombo.getBinding("items");
                oCityBinding.filter([
                    new sap.ui.model.Filter("stateName", sap.ui.model.FilterOperator.EQ, sStateName),
                    new sap.ui.model.Filter("countryCode", sap.ui.model.FilterOperator.EQ, sCountryCode)
                ]);
                oCityCombo.setSelectedKey(""); // Reset city selection
            },
            //PDF download function
            EOUF_onPressMerge: async function () {
                var oModel = this.getView().getModel("employeeModel");
                this.getView().getModel("employeeModel").setProperty("/Status", "New");
                await this.updateCallForEmployeeOffer(this.getView().getModel("viewModel"), "silent");
                this.offerGeneratingPdfFunction(oModel);
            },
            //pdf generate function
            async offerGeneratingPdfFunction(oModel) {
                this.getBusyDialog();
                const _setIfNotZero = (model, path, value, currency) => {
                    if (value && Number(value) !== 0) {
                        model.setProperty(path, currency + " " + Formatter.fromatNumber(value));
                    } else {
                        model.setProperty(path, "");
                    }
                };

                try {
                    var oEmpModel = oModel.getData();
                    await this._fetchCommonData("PDFCondition", "PDFConditionModel", { Type: "EmployeeOffer" });
                    var oPDFModel = this.getView().getModel("PDFData");

                    // Employee details mapping
                    oPDFModel.setProperty("/Type", "Employee Offer");
                    oPDFModel.setProperty("/EmpName", oEmpModel.Salutation + " " + oEmpModel.ConsultantName);
                    oPDFModel.setProperty("/EmpRole", oEmpModel.Designation);
                    oPDFModel.setProperty("/EmpAddress", oEmpModel.ConsultantAddress + ", " + oEmpModel.PinCode);
                    oPDFModel.setProperty("/CreateDate", Formatter.formatDate(oEmpModel.OfferReleaseDate));
                    oPDFModel.setProperty("/JoiningDate", Formatter.formatDate(oEmpModel.JoiningDate));
                    oPDFModel.setProperty("/EmpCTC", oEmpModel.Currency + " " + Formatter.fromatNumber(oEmpModel.CostofCompany));

                    // Bond Condition
                    if (oEmpModel.EmploymentBond == "0" || !oEmpModel.EmploymentBond) {
                        oPDFModel.setProperty("/BondCondition", "18 employment months");
                        oPDFModel.setProperty("/BondCondition2", "");
                    } else {
                        oPDFModel.setProperty("/BondCondition", oEmpModel.EmploymentBond + " employment year(s)");
                        if (oEmpModel.EmploymentBond == "1") {
                            oPDFModel.setProperty("/BondCondition2", "any training costs and during 18 employment months, ");
                        } else {
                            oPDFModel.setProperty("/BondCondition2", "any training costs and ");
                        }
                    }

                    // Yearly Components / Deductions / Variable / GrossPay
                    _setIfNotZero(oPDFModel, "/YearlyComponents/0/Text", oEmpModel.Total, oEmpModel.Currency);
                    _setIfNotZero(oPDFModel, "/YearlyComponents/1/Text", oEmpModel.BasicSalary, oEmpModel.Currency);
                    _setIfNotZero(oPDFModel, "/YearlyComponents/2/Text", oEmpModel.HRA, oEmpModel.Currency);
                    _setIfNotZero(oPDFModel, "/YearlyComponents/3/Text", oEmpModel.EmployerPF, oEmpModel.Currency);
                    _setIfNotZero(oPDFModel, "/YearlyComponents/4/Text", oEmpModel.MedicalInsurance, oEmpModel.Currency);
                    _setIfNotZero(oPDFModel, "/YearlyComponents/5/Text", oEmpModel.Gratuity, oEmpModel.Currency);
                    _setIfNotZero(oPDFModel, "/YearlyComponents/6/Text", oEmpModel.SpecailAllowance, oEmpModel.Currency);

                    _setIfNotZero(oPDFModel, "/Deductions/0/Text", oEmpModel.TotalDeduction, oEmpModel.Currency);
                    _setIfNotZero(oPDFModel, "/Deductions/1/Text", oEmpModel.IncomeTax, oEmpModel.Currency);
                    _setIfNotZero(oPDFModel, "/Deductions/2/Text", oEmpModel.EmployeePF, oEmpModel.Currency);
                    _setIfNotZero(oPDFModel, "/Deductions/3/Text", oEmpModel.PT, oEmpModel.Currency);

                    _setIfNotZero(oPDFModel, "/VariableComponents/0/Text", oEmpModel.VariablePay, oEmpModel.Currency);
                    _setIfNotZero(oPDFModel, "/GrossPay/0/Text", oEmpModel.GrossPay, oEmpModel.Currency);
                    _setIfNotZero(oPDFModel, "/GrossPay/1/Text", oEmpModel.GrossPayMontly, oEmpModel.Currency);

                    if (oEmpModel.JoiningBonus == "0") {
                        oPDFModel.setProperty("/Notes/0/Text", "0");
                    } else {
                        oPDFModel.setProperty("/Notes/0/Text", oEmpModel.Currency + " " + Formatter.fromatNumber(oEmpModel.JoiningBonus));
                    }

                    // --- Company Details Fetch ---
                    let filter = { companyCode: oEmpModel.CompanyCode };
                    let apiResponse;
                    try {
                        apiResponse = await this.ajaxReadWithJQuery("CompanyCodeDetails", filter);
                    } catch (err) {
                        MessageToast.show(err.message || err.responseText);
                        this.closeBusyDialog();
                        return;
                    }

                    const oCompanyDetailsModel = apiResponse.data[0];
                    oPDFModel.setProperty("/Headers/0/Text", oCompanyDetailsModel.companyName);
                    oPDFModel.setProperty("/Headers/1/Text", oCompanyDetailsModel.branch);

                    var oPDFConditionModel = this.getView().getModel("PDFConditionModel").getData();

                    // --- Images ---
                    if (!oCompanyDetailsModel.companylogo64 &&
                        !oCompanyDetailsModel.signature64 &&
                        !oCompanyDetailsModel.backgroundLogoBase64 &&
                        !oCompanyDetailsModel.emailLogoBase64) {

                        try {
                            const logoBlob = new Blob([new Uint8Array(oCompanyDetailsModel.companylogo?.data)], { type: "image/png" });
                            const signBlob = new Blob([new Uint8Array(oCompanyDetailsModel.signature?.data)], { type: "image/png" });
                            const backgroundBlob = new Blob([new Uint8Array(oCompanyDetailsModel.backgroundLogo?.data)], { type: "image/png" });
                            const emailBlob = new Blob([new Uint8Array(oCompanyDetailsModel.emailLogo?.data)], { type: "image/png" });

                            const [logoBase64, signBase64, backgroundBase64, emailBase64] = await Promise.all([
                                this._convertBLOBToImage(logoBlob),
                                this._convertBLOBToImage(signBlob),
                                this._convertBLOBToImage(backgroundBlob),
                                this._convertBLOBToImage(emailBlob)
                            ]);

                            oCompanyDetailsModel.companylogo64 = logoBase64;
                            oCompanyDetailsModel.signature64 = signBase64;
                            oCompanyDetailsModel.backgroundLogoBase64 = backgroundBase64;
                            oCompanyDetailsModel.emailLogoBase64 = emailBase64;
                        } catch (err) {
                            console.error("Image compression failed:", err);
                        }
                    }

                    // --- PDF Generation ---
                    if (oCompanyDetailsModel.companylogo64 && oCompanyDetailsModel.signature64) {
                        if (typeof jsPDF !== "undefined" && typeof jsPDF._GeneratePDF === "function") {
                            jsPDF._GeneratePDF(this, oPDFModel.getData(), oCompanyDetailsModel, oPDFConditionModel);
                        }
                    }

                } catch (outerErr) {
                    MessageToast.show(err.message || err.responseText);
                    this.closeBusyDialog();
                } finally {
                    this.closeBusyDialog();
                }
            },
            onSalutationChange: function (oEvent) {
                this.onSalutationChangeCommon(
                    oEvent,
                    "employeeModel",       // name of the model
                    "/Gender",           // path to gender property
                    "EOU_id_Gender"        // ID of the gender control
                );
            },
            onCreateSalutationChange: function (oEvent) {
                this.onSalutationChangeCommon(
                    oEvent,
                    "employeeModel",       // name of the model
                    "/Gender",           // path to gender property
                    "EOD_id_Gender"        // ID of the gender control
                );
            }
        });
    });
