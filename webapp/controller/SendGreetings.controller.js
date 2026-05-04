sap.ui.define(
    [
        "./BaseController", // Import BaseController 
        "sap/ui/model/json/JSONModel",
        "../model/formatter", // Import formatter utility
        "sap/m/MessageToast", // Import MessageToast for notifications
    ],
    function(BaseController, JSONModel, Formatter, MessageToast) {
        "use strict";
        return BaseController.extend(
            "sap.kt.com.minihrsolution.controller.SendGreetings", {
                Formatter: Formatter,
                onInit: function() {
                    const oUploaderDataModel = new JSONModel({
                        attachments: [], // holds uploaded files
                        isFileUploaded: false,
                        name: "",
                        mimeType: "",
                        content: ""
                    });
                    this.getView().setModel(oUploaderDataModel, "UploaderData");
                    this.getRouter().getRoute("RouteSendGreetings").attachMatched(this._onRouteMatched, this);
                },

                _onRouteMatched: async function() {
                    try {
                        var LoginFUnction = await this.commonLoginFunction("Greeting");
                        if (!LoginFUnction) return;
                        // i18n Resource
                        this.i18nModel = this.getView().getModel("i18n").getResourceBundle();
                        this.getView().getModel("LoginModel").setProperty("/HeaderName", this.i18nModel.getText("sendGreetingsTitle"));
                        this.onCancelWishMail()

                        // Fetch data
                        await this._fetchCommonData("EmployeeDetails", "EmpDetails");
                        await this._fetchCommonData("ManageCustomer", "ManageCustomerModel");

                        // Create Models
                        this.CreateallEmployeeModel();
                        this.ManageCustomerModel();
 
                        // Load default Email Type = Employee Offer (index 0)
                        this._loadEmailTypeData("employeeOffer");
                        this.initializeBirthdayCarousel();
                    } catch (error) {
                        this.closeBusyDialog();
                        MessageToast.show(error.message || error.responseText);
                    } finally {
                        this.closeBusyDialog();
                    }
                },

                CreateallEmployeeModel: function() {
                    var empData = this.getView().getModel("EmpDetails").getData() || [];
                    var oFullModel = new sap.ui.model.json.JSONModel(empData);
                    this.getOwnerComponent().setModel(oFullModel, "AllEmployeedataModel");
                },

                ManageCustomerModel: function() {
                    var custData = this.getView().getModel("ManageCustomerModel").getData() || [];
                    var oFullcustDataModel = new sap.ui.model.json.JSONModel(custData);
                    this.getOwnerComponent().setModel(oFullcustDataModel, "AllCustDataModelModel");
                },

                // Called when user switches radio button
                onRadioButtonSelect: function(oEvent) {
                    const oSelectedBtn = oEvent.getSource().getSelectedButton();
                    const sSelectedText = oSelectedBtn.getText();

                    if (sSelectedText.includes(this.i18nModel.getText("employeeOffer"))) {
                        this._loadEmailTypeData("employeeOffer");
                    } else if (sSelectedText.includes(this.i18nModel.getText("contractOffer"))) {
                        this._loadEmailTypeData("contractOffer");
                    } else if (sSelectedText.includes(this.i18nModel.getText("traineeOffer"))) {
                        this._loadEmailTypeData("traineeOffer");
                    } else if (sSelectedText.includes(this.i18nModel.getText("customer"))) {
                        this._loadEmailTypeData("customer");
                    }
                },

                // Helper function: Filter and Bind MultiComboBox Data
                _loadEmailTypeData: function(type) {
                    const oMultiComboBox = this.getView().byId("Wish_id_EmployeeEmail");
                    let aData = [];
                    let oModel;

                    if (type === "employeeOffer" || type === "contractOffer" || type === "traineeOffer") {
                        const empData = this.getOwnerComponent().getModel("AllEmployeedataModel").getData() || [];

                        aData = empData.filter(emp => {
                            // Only Active employees
                            if (emp.EmployeeStatus !== "Active") return false;

                            if (type === "employeeOffer" && emp.EmployeeID.startsWith("KT0")) return true;
                            if (type === "contractOffer" && emp.EmployeeID.startsWith("KT-C")) return true;
                            if (type === "traineeOffer" && emp.EmployeeID.startsWith("KT-T")) return true;

                            return false;
                        }).map(emp => ({
                            key: emp.EmployeeID,
                            text: emp.EmployeeID,
                            additionalText: emp.EmployeeName
                        }));

                    } else if (type === "customer") {
                        const custData = this.getOwnerComponent().getModel("AllCustDataModelModel").getData() || [];
                        aData = custData.map(cust => ({
                            key: cust.name,
                            text: cust.name,
                            additionalText: cust.companyName
                        }));
                    }

                    // Bind to MultiComboBox
                    oModel = new sap.ui.model.json.JSONModel(aData);
                    oMultiComboBox.setModel(oModel);
                    oMultiComboBox.bindItems("/", new sap.ui.core.ListItem({
                        key: "{key}",
                        text: "{text}",
                        additionalText: "{additionalText}"
                    }));

                    // Clear previous selection
                    oMultiComboBox.removeAllSelectedItems();
                    oMultiComboBox.setValueState("None");
                },

                onSendWishMail: function () {
                    const oView = this.getView();
                    const oMultiComboBox = oView.byId("Wish_id_EmployeeEmail");
                    const oToEmailInput = oView.byId("Wish_id_ToEmail");
                    const oSubject = oView.byId("Wish_id_EmailSubject");
                    const oRTE = oView.byId("Wish_id_EmailBody");

                    const aSelectedItems = oMultiComboBox.getSelectedItems();
                    const sManualEmail = oToEmailInput.getValue().trim();

                    let toEmails = [];

                    // Validate that at least one recipient is provided
                    if (aSelectedItems.length === 0 && !sManualEmail) {
                        sap.m.MessageToast.show("Please provide at least one recipient — select from list or enter an email ID.");
                        oMultiComboBox.setValueState("Error");
                        oToEmailInput.setValueState("Error");
                        return;
                    } else {
                        oMultiComboBox.setValueState("None");
                        oToEmailInput.setValueState("None");
                    }

                    // Get selected radio button
                    const oSelectedBtn = oView.byId("Wish_id_RadioGroup").getSelectedButton();
                    const sSelectedText = oSelectedBtn ? oSelectedBtn.getText() : "";

                    // Collect MultiComboBox emails
                    if (aSelectedItems.length > 0) {
                        if (
                            sSelectedText.includes(this.i18nModel.getText("employeeOffer")) ||
                            sSelectedText.includes(this.i18nModel.getText("contractOffer")) ||
                            sSelectedText.includes(this.i18nModel.getText("traineeOffer"))
                        ) {
                            const empData = this.getOwnerComponent().getModel("AllEmployeedataModel").getData() || [];

                            aSelectedItems.forEach(item => {
                                const emp = empData.find(e => e.EmployeeID === item.getKey());
                                if (emp && emp.CompanyEmailID) {
                                    toEmails.push(emp.CompanyEmailID);
                                }
                            });
                        } else if (sSelectedText.includes(this.i18nModel.getText("customer"))) {
                            const custData = this.getOwnerComponent().getModel("AllCustDataModelModel").getData() || [];

                            aSelectedItems.forEach(item => {
                                const cust = custData.find(c => c.name === item.getKey());
                                if (cust) {
                                    if (cust.customerEmail) toEmails.push(cust.customerEmail);
                                    if (cust.mailID) toEmails.push(cust.mailID);
                                }
                            });
                        }
                    }

                    // Validate manual email if entered
                    if (sManualEmail) {
                        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                        const manualEmails = sManualEmail.split(/[;,]+/).map(e => e.trim()).filter(e => e);
                        const invalidEmails = manualEmails.filter(e => !emailPattern.test(e));

                        if (invalidEmails.length > 0) {
                            oToEmailInput.setValueState("Error");
                            sap.m.MessageToast.show("Please enter valid email ID(s).");
                            return;
                        } else {
                            oToEmailInput.setValueState("None");
                            toEmails = toEmails.concat(manualEmails);
                        }
                    }

                    if (toEmails.length === 0) {
                        sap.m.MessageToast.show("Please select recipients with valid email addresses.");
                        return;
                    }

                    // Validate subject and body
                    const subjectValue = oSubject.getValue().trim();
                    const bodyValue = oRTE.getValue().trim();

                    if (subjectValue.length === 0) {
                        sap.m.MessageToast.show("Subject cannot be empty.");
                        oSubject.setValueState("Error").focus();
                        return;
                    } else {
                        oSubject.setValueState("None");
                    }

                    if (bodyValue.replace(/<[^>]*>/g, "").trim().length === 0) {
                        sap.m.MessageToast.show("Email body cannot be empty.");
                        oRTE.addStyleClass("sapUiRTEErrorBorder");
                        return;
                    }

                    const sWarmRegards = this.i18nModel.getText("warmRegards");
                    const sFooter = this.i18nModel.getText("sendGreetingsFooter");

                    const finalBody = `${bodyValue}<p>${sWarmRegards}<br>${sFooter}</p>`;

                    // Build payload
                    const payload = {
                        toEmailID: toEmails.join(","),
                        subject: subjectValue,
                        body: finalBody,
                        attachments: this.getView().getModel("UploaderData").getProperty("/attachments"),
                    };

                    // Send email via AJAX
                    this.getBusyDialog();
                    this.ajaxCreateWithJQuery("SendWishesEmail", payload).then(() => {
                            this.closeBusyDialog();
                            this.clearWishesAttachment();
                            sap.m.MessageToast.show("Email sent successfully!");
                            this.onCancelWishMail();
                        }).catch((oError) => {
                            this.closeBusyDialog();
                            sap.m.MessageToast.show(oError.responseText);
                        });
                },

                onCancelWishMail: function() {
                    const oView = this.getView();
                    oView.byId("Wish_id_EmailSubject").setValue("");
                    oView.byId("Wish_id_EmailBody").setValue("");
                    oView.byId("Wish_id_ToEmail").setValue("");

                    const oMultiComboBox = oView.byId("Wish_id_EmployeeEmail");
                    if (oMultiComboBox) {
                        oMultiComboBox.removeAllSelectedItems();
                    }

                    // Clear all uploaded attachments
                    this.clearWishesAttachment();
                },

                clearWishesAttachment: function() {
                    const oFileUploader = this.getView().byId("Wish_id_FileUploader");
                    const oUploaderData = this.getView().getModel("UploaderData");

                    if (oFileUploader) oFileUploader.clear();

                    if (oUploaderData) {
                        oUploaderData.setProperty("/attachments", []);
                        oUploaderData.setProperty("/isFileUploaded", false);
                        oUploaderData.setProperty("/name", "");
                    }

                    const oTable = this.getView().byId("Wish_id_AttachmentsTable");
                    if (oTable) oTable.removeSelections();
                },

                onRTEChange: function(oEvent) {
                    const oRTE = oEvent.getSource();
                    this._validateRTE(oRTE);
                },

                _validateRTE: function(oRTE) {
                    const sRTEValue = oRTE.getValue();
                    const iRTELength = sRTEValue.replace(/<[^>]*>/g, "").trim().length;
                    if (iRTELength === 0) {
                        oRTE.addStyleClass("sapUiRTEErrorBorder");
                        return false;
                    } else {
                        oRTE.removeStyleClass("sapUiRTEErrorBorder");
                        return true;
                    }
                },

                onFileSizeExceeds: function() {
                    sap.m.MessageToast.show("File size exceeds the limit (5MB).");
                },

                onFileSelected: function(oEvent) {
                    this.handleFileUpload(
                        oEvent,
                        this, // context
                        "UploaderData", // model name
                        "/attachments", // path to attachment array
                        "/name", // path to comma-separated file names
                        "/isFileUploaded", // boolean flag path
                        "uploadSuccessfull", // i18n success key
                        "fileAlreadyUploaded", // i18n duplicate key
                        "noFileSelected", // i18n no file selected
                        "fileReadError" // i18n file read error
                    );
                },

                onLiveChangeSubject: function (oEvent) {
                    const oInput = oEvent.getSource();
                    const sValue = oInput.getValue().trim();
                    if (sValue.length === 0) {
                        oInput.setValueState("Error");
                        oInput.setValueStateText("Subject cannot be empty.");
                    } else {
                        oInput.setValueState("None");
                        oInput.setValueStateText("");
                    }
                },

                onEmailSelectionChange: function(oEvent) {
                    var oMultiComboBox = oEvent.getSource();
                    var sNewValue = oEvent.getParameter("newValue");
                    var oToEmailInput = this.getView().byId("Wish_id_ToEmail");
                    if (sNewValue) {
                        oMultiComboBox.setValueState("None");
                         oToEmailInput.setValueState("None");
                    } else {
                        oMultiComboBox.setValueState("Error");
                        oMultiComboBox.setValueStateText(this.i18nModel.getText("selectAtLeastOneRecipient"));
                    }
                },

                onChangeRecipientEmail: function (oEvent) {
                    const oView = this.getView();
                    const oToEmailInput = oView.byId("Wish_id_ToEmail");
                    const oMultiComboBox = oView.byId("Wish_id_EmployeeEmail");
                    const sValue = oEvent.getParameter("value").trim();

                    if (sValue) {
                        // Clear error on both fields when manual email entered
                        oToEmailInput.setValueState("None");
                        oMultiComboBox.setValueState("None");
                    }
                },

                onPressback: function() {
                    this.getRouter().navTo("RouteTilePage"); // Navigate to tile page
                },

                onLogout: function() {
                    this.CommonLogoutFunction(); // Navigate to login page
                },
            }
        );
    }
);