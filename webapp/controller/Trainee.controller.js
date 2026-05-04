sap.ui.define([
    "./BaseController", //call base controller
    "../utils/validation", // call validation function
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "../model/formatter",
    "sap/ui/export/Spreadsheet"
],
    function (BaseController, utils, JSONModel, MessageToast, MessageBox, Formatter, Spreadsheet) {
        "use strict";
        return BaseController.extend("sap.kt.com.minihrsolution.controller.Trainee", {
            Formatter: Formatter,
            onInit: function () {
                this.getRouter().getRoute("RouteTrainee").attachMatched(this._onRouteMatched, this);
            },
            _onRouteMatched: async function (oEvent) {
                var LoginFunction = await this.commonLoginFunction("Trainee");
                if (!LoginFunction) return;

                this.getBusyDialog();
                this.companyName = "Kvriksha Technologies Private Limited"; // TO AVOID ONE MORE AJAX CALL (By Shivang)
                this.i18nModel = this.getView().getModel("i18n").getResourceBundle();

                this.byId("T_id_OnboardBtn").setEnabled(false);
                this.byId("T_id_RejectBtn").setEnabled(false);
                this.byId("T_id_Download").setVisible(false);
                this.byId("T_id_EmpOnBoard").setVisible(false);
                this.byId("T_id_ResendEmail").setEnabled(false);
                this.byId("T_id_Cermail").setVisible(false);
                this.getView().getModel("CompanyCodeDetailsModel")?.refresh(true);

                this.getView().getModel("LoginModel").setProperty("/HeaderName", this.i18nModel.getText("traineeEdit"));
                this.oValue = oEvent.getParameter("arguments").value;
                const from = oEvent.getParameter("arguments").from;
                this.Filter = true;
                this._fetchCommonData("EmployeeDetailsData", "empModel");

                const oDateControl = this.byId("T_id_JoiningDate");
                const oFilterState = this.getOwnerComponent().getModel("TraineeFilterState")?.getData();

                const { startDate, endDate } = this._getCurrentYearDates();
                const oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "yyyy-MM-dd" });

                try {
                    this._isClearPressed = false;

                    // PRIORITY 1: Restore from detail navigation
                    if (oFilterState?.fromDetail) {
                        if (oDateControl) {
                            oDateControl.setDateValue(oFilterState.startDate);
                            oDateControl.setSecondDateValue(oFilterState.endDate);
                        }
                        this.getOwnerComponent().getModel("TraineeFilterState").setProperty("/fromDetail", false);

                        await this.T_onSearch(); // preserve filters
                    }

                    // PRIORITY 2: Normal navigation (NOT from edit)
                    else if (this.oValue === "Trainee" && from !== "TraineeDetails") {

                        this.onClearAndSearch("T_id_Filterbar"); 

                        if (oDateControl) {
                            oDateControl.setDateValue(startDate);
                            oDateControl.setSecondDateValue(endDate);
                        }

                        const params = {
                            startDate: oDateFormat.format(startDate),
                            endDate: oDateFormat.format(endDate)
                        };

                        await this._fetchCommonData("Trainee", "traineeNameModel", {
                            startDate: params.startDate,
                            endDate: params.endDate
                        });
                        const oInitialModel = this.getView().getModel("traineeNameModel");
                        const aInitialData = oInitialModel.getData();
                        const uniqueTrainees = [];
                        const seenNames = new Set();
                        aInitialData.forEach(item => {
                            if (item.TraineeName && !seenNames.has(item.TraineeName)) {
                                seenNames.add(item.TraineeName);
                                uniqueTrainees.push(item);
                            }
                        });
                        oInitialModel.setData(uniqueTrainees);
                        await this._fetchCommonData("Trainee", "traineeModel", params);
                    }

                    //PRIORITY 3: Edit / back navigation → preserve filters
                    else {
                        await this.T_onSearch();
                    }
                    this.initializeBirthdayCarousel();
                } catch (error) {
                    sap.m.MessageToast.show(error.message || error.responseText);
                } finally {
                    this.closeBusyDialog();
                }
            },
            //  current year start and end dates
            _getCurrentYearDates: function () {
                var year = new Date().getFullYear();
                var startDate = new Date(year, 0, 1); // Jan 1
                var endDate = new Date(year, 11, 31); // Dec 31
                return {
                    startDate,
                    endDate
                };
            },
            //validation function for mandatory fields
            T_ValidateCommonFields: function (oEvent) {
                utils._LCvalidateMandatoryField(oEvent);
            },
            //validation function for email
            T_validateEmail: function (oEvent) {
                utils._LCvalidateEmail(oEvent);
            },
            //validation function for date
            onPressback: function () {
                this.getRouter().navTo("RouteTilePage");
            },
            //validation function for date
            onLogout: function () {
                this.getRouter().navTo("RouteLoginPage");
                this.CommonLogoutFunction();
            },
            //Trainee creation button
            T_onPressAddTrainee: function (oEvent) {
                const oDate = this.byId("T_id_JoiningDate");

                this.getOwnerComponent().setModel(
                    new JSONModel({
                        startDate: oDate.getDateValue(),
                        endDate: oDate.getSecondDateValue(),
                        fromDetail: true
                    }), "TraineeFilterState");
                var oParValue;
                // Check if the button pressed is the "Add Trainee" button by looking at its ID
                if (oEvent.getSource().getId().lastIndexOf("T_id_AddBtn") !== -1) {
                    oParValue = "CreateTraineeFlag"
                } else {
                    // Else navigation to existing trainee details
                    oParValue = oEvent.getSource().getBindingContext("traineeModel").getModel().getData()[oEvent.getSource().getBindingContextPath().split("/")[1]].ID
                }
                this.getRouter().navTo("RouteTraineeDetails", {
                    sParTrainee: oParValue
                });
            },
            // common open the dialog function
            T_commonOpenDialog: function (dialogProperty, fragmentName) {
                if (!this[dialogProperty]) {
                    sap.ui.core.Fragment.load({
                        name: fragmentName,
                        controller: this
                    }).then(function (oDialog) {
                        this[dialogProperty] = oDialog;
                        this.getView().addDependent(this[dialogProperty]);
                        this[dialogProperty].open();
                    }.bind(this)).catch(function (oError) { });
                } else {
                    this[dialogProperty].open();
                }
            },
            //Trainee table selection change function for button visibility
            T_onTableSelectionChange: function (oEvent) {
                var oSelectedItem = oEvent.getParameter("listItem");
                this.SelectedData = oSelectedItem.getBindingContext("traineeModel").getObject();
                if (oSelectedItem) {
                    var sStatus = oSelectedItem.getBindingContext("traineeModel").getProperty("Status");
                    var isDisabled = sStatus === "Onboarded" || sStatus === "Rejected";
                    this.byId("T_id_OnboardBtn").setEnabled(!isDisabled);
                    this.byId("T_id_RejectBtn").setEnabled(!isDisabled);
                    this.byId("T_id_ResendEmail").setEnabled(sStatus === "Onboarded");
                    var isCertificateVisible = sStatus === "Training Completed" || sStatus === "Onboarded";
                    this.byId("T_id_Download").setVisible(isCertificateVisible);
                    var isEmpOnBoardVisible = sStatus === "Training Completed";
                    this.byId("T_id_EmpOnBoard").setVisible(isEmpOnBoardVisible);
                    this.byId("T_id_Cermail").setVisible(isEmpOnBoardVisible);
                    var isOtherButtonsVisible = sStatus !== "Training Completed";
                    this.byId("T_id_OnboardBtn").setVisible(isOtherButtonsVisible);
                    this.byId("T_id_RejectBtn").setVisible(isOtherButtonsVisible);
                }
            },
            //update call for trainee
            updateCallForTrainee: async function (oTraineeData, text) {
                try {
                    this.getBusyDialog();
                    var that = this;
                    if (oTraineeData.Status === "Onboarded") {
                        oTraineeData.CompanyEmailID = sap.ui.getCore().byId("OTF_id_TraineeMail").getValue();
                    }
                    var oModelOffer = {
                        "data": oTraineeData,
                        "filters": {
                            "ID": oTraineeData.ID
                        }
                    };
                    await this.ajaxUpdateWithJQuery("Trainee", oModelOffer).then((oData) => {
                        MessageToast.show(that.i18nModel.getText(text));
                        this.closeBusyDialog();
                    }).catch((error) => {
                        this.getBusyDialog();
                        MessageToast.show(error.message || error.responseText);
                    });
                } catch (error) {
                    this.closeBusyDialog();
                    MessageToast.show(this.i18nModel.getText("technicalError"));
                }
            },
            //trainee onboard confirmation 
            T_onOnboardPress: function () {
                this.onHandleTraineeAction("onboard");
            },
            //trainee reject confirmation
            T_onRejectPress: function () {
                this.onHandleTraineeAction("reject");
            },
            //confirmation dialog function for trainee onboard and reject
            onHandleTraineeAction: function (action) {
                try {
                    var that = this;
                    var oContext = this.byId("T_id_TraineeTable").getSelectedItem()?.getBindingContext("traineeModel");
                    if (!oContext) {
                        MessageToast.show(this.i18nModel.getText("SelectTraineeMessage"));
                        return;
                    }
                    var sName = oContext.getProperty("NameSalutation") + " " + oContext.getProperty("TraineeName");
                    var sMessage = (action === "onboard") ?
                        this.i18nModel.getText("OnboardMessage", [sName]) :
                        this.i18nModel.getText("RejectMessage", [sName]);
                    this.showConfirmationDialog(
                        this.i18nModel.getText("ConfirmActionTitle"),
                        sMessage,
                        function () {
                            // On Confirm
                            if (action === "onboard") {
                                that.T_commonOpenDialog("TOb_oDialog", "sap.kt.com.minihrsolution.fragment.OnboardTrainee");
                            } else if (action === "reject") {
                                that._handleReject(oContext);
                            }
                            // Clear selection after confirm
                            that.byId("T_id_TraineeTable").removeSelections(true);
                        },
                        function () {
                            that.T_ButtonVisibility();
                        }
                    );
                } catch (error) {
                    MessageToast.show(this.i18nModel.getText("technicalError"));
                }
            },
            T_ButtonVisibility: function () {
                this.byId("T_id_OnboardBtn").setEnabled(false);
                this.byId("T_id_RejectBtn").setEnabled(false);
                this.byId("T_id_TraineeTable").removeSelections(true);
            },
            //Reject trainee function
            _handleReject: async function (oContext) {
                this.getBusyDialog();
                oContext.getModel().setProperty(oContext.getPath() + "/Status", "Rejected");
                await this.updateCallForTrainee(oContext.getObject(), "traineeRejectSucess");
                this.T_ButtonVisibility();
                this.T_onSearch();
            },
            //Onboard trainee function
            OTF_onPressOnboard: async function (oTraineeData) {
                try {
                    if (utils._LCvalidateEmail(sap.ui.getCore().byId("OTF_id_TraineeMail"), "ID")) {
                        var oTraineeData = this.SelectedData;
                        oTraineeData.Status = "Onboarded";
                        await this.updateCallForTrainee(oTraineeData, "traineeOnboardSucess");
                        this.getView().getModel("traineeModel").setProperty("/Status", "Onboarded");
                        this.OTF_onPressClose();
                        // Clear selection and disable buttons
                        this.T_ButtonVisibility();
                        this.T_onSearch();
                    } else {
                        MessageToast.show(this.i18nModel.getText("mandetoryFields"));
                    }
                } catch (error) {
                    MessageToast.show(error.message || error.responseText);
                }
            },
            T_Button: function () {
                this.byId("T_id_OnboardBtn").setVisible(true);
                this.byId("T_id_RejectBtn").setVisible(true);
                this.byId("T_id_Download").setVisible(false);
                this.byId("T_id_EmpOnBoard").setVisible(false);
                this.byId("T_id_Cermail").setVisible(false);
            },
            //Close the  onboarding dialog function
            OTF_onPressClose: function () {
                sap.ui.getCore().byId("OTF_id_TraineeMail").setValueState("None");
                sap.ui.getCore().byId("OTF_id_TraineeMail").setValue("");
                this.T_ButtonVisibility()
                this.TOb_oDialog.close();
            },
            //Trainee  certificate  dialog function
            T_onCertDownload: function () {
                var oSelectedItem = this.byId("T_id_TraineeTable").getSelectedItem();

                if (!oSelectedItem) {
                    MessageToast.show("Please select a row");
                    return;
                }

                var oTraineeModel = oSelectedItem.getBindingContext("traineeModel").getObject();

                // Ensure JoiningDate is a Date object
                var oJoiningDate = new Date(oTraineeModel.JoiningDate);
                oTraineeModel.JoiningDate = oJoiningDate;

                var trainingDuration = oTraineeModel.TrainingDuration;
                var monthsMatch = trainingDuration.match(/(\d+)/);
                var months = monthsMatch ? parseInt(monthsMatch[0]) : 0;

                if (months === 0) {
                    console.error("Invalid training duration");
                    return;
                }

                var oCalculatedEndDate = new Date(oJoiningDate);
                oCalculatedEndDate.setMonth(oCalculatedEndDate.getMonth() + months);
                oCalculatedEndDate.setDate(oCalculatedEndDate.getDate() - 1);

                // Assign Date object directly
                oTraineeModel.EndDate = oCalculatedEndDate;

                // Refresh model to reflect changes
                this.getView().getModel("traineeModel").refresh(true);

                var oTraineeContext = oSelectedItem.getBindingContext("traineeModel");
                this.getView().setBindingContext(oTraineeContext, "traineeModel");

                this.T_commonOpenDialog(
                    "TC_oDialog",
                    "sap.kt.com.minihrsolution.fragment.TraineeCertificate",
                    "TCF_id_EndDate"
                );
            },

            //Close the certificate dialog function
            TCF_onPressCloseDialog: function () {
                this.getView().getModel("PDFData").setProperty("/PreviewFlag", false);
                this.getView().getModel("PDFData").setProperty("/RTEText", "<p>Please click on <b>Preview Certificate</b> to Preview the Certificate</p>");
                sap.ui.getCore().byId("TCF_id_ProjectName").setValueState("None");
                sap.ui.getCore().byId("TCF_id_ProjectName").setValue("");
                this.byId("T_id_ResendEmail").setEnabled(false);
                this.T_ButtonVisibility();
                this.TC_oDialog.close();
                this.T_Button();
            },
            //Preview and download certificate function
            TCF_onPressHandlePreview: function () {
                const bPreviewFlag = this.getView().getModel("PDFData").getProperty("/PreviewFlag");
                if (bPreviewFlag) {
                    this.TCF_onPressDownload();
                } else {
                    this.TCF_onPressPreview();
                }
            },
            //download certificate
            TCF_onPressPreview: function () {
                if (!utils._LCvalidateMandatoryField(sap.ui.getCore().byId("TCF_id_ProjectName"), "ID")) {
                    MessageToast.show(this.i18nModel.getText("mandetoryFields"));
                    return;
                }
                let oSelectedItem = this.byId("T_id_TraineeTable").getSelectedItem();
                let oTraineeModel = oSelectedItem.getBindingContext("traineeModel").getObject();
                var empName = oTraineeModel.NameSalutation + " " + oTraineeModel.TraineeName;
                var joinDate = Formatter.formatDate(oTraineeModel.JoiningDate);
                var endDate = sap.ui.getCore().byId("TCF_id_EndDate").getValue();
                var role = "Trainee";
                var department = sap.ui.getCore().byId("TCF_id_Department").getSelectedKey();
                var projectName = oTraineeModel.ProjectName;
                var supervisor = oTraineeModel.ReportingManager;
                var data = `
                <div style="text-align: justify;">
                    <p>This is to certify that <b>${empName}</b> has successfully completed an internship at <b>${this.companyName}</b> from <b>${joinDate}</b> to <b>${endDate}</b>.</p> 
                    <p>During this period, ${empName} was assigned the role of <b>${role}</b> in the ${department} department and worked on the <b>${projectName}</b>. The performance, skills, and dedication demonstrated by ${empName} during the internship have been highly commendable.</p>
                    <p>We wish ${empName} all the best in future endeavors and career pursuits.</p>
                    <h3>Details of the Internship:</h3>
                    <div style="margin-left: 10px;">
                        <p style="margin: 3px 0;"><b>• Intern's Name: ${empName}</b></p>
                        <p style="margin: 3px 0;"><b>• Position: ${role}</b></p>
                        <p style="margin: 3px 0;"><b>• Internship Duration: ${joinDate} to ${endDate}</b></p>
                        <p style="margin: 3px 0;"><b>• Department: ${department}</b></p>
                        <p style="margin: 3px 0;"><b>• Supervisor: ${supervisor}</b></p>
                        <p style="margin: 3px 0;"><b>• Project/Tasks: ${projectName}</b></p>
                    </div>
                    <p>We at <b>${this.companyName}</b> thank ${empName} for the valuable contributions made to our organization and wish success in all future endeavors.</p>
                </div>`;
                this.getView().getModel("PDFData").setProperty("/RTEText", data);
                this.getView().getModel("PDFData").setProperty("/PreviewFlag", true);
            },
            //generate PDF function
            TCF_onPressDownload: async function () {
                var oRTE = sap.ui.getCore().byId("myRTE");
                var oEditor = oRTE._oEditor?.editorManager?.activeEditor;
                if (oEditor) {
                    var plainText = oEditor.getContent({
                        format: 'text'
                    });
                    var charCount = plainText.length;
                    var lines = plainText.split(/\r\n|\r|\n/);
                    var lineCount = lines.length;
                } else {
                    MessageToast.show(this.i18nModel.getText("technicalError"));
                    return;
                }
                if (charCount > 1000 || lineCount > 21) {
                    MessageBox.error("Certificate content exceeds the limit of 1000 characters or 21 lines.");
                    return;
                }
                try {
                    // Get selected trainee's data from the table
                    let oSelectedItem = this.byId("T_id_TraineeTable").getSelectedItem();
                    let oTraineeModel = oSelectedItem.getBindingContext("traineeModel").getObject();
                    var oEndDatePicker = sap.ui.getCore().byId("TCF_id_EndDate");
                    var oSelectedEndDate = oEndDatePicker.getDateValue();

                    let finalEndDate;

                    if (oSelectedEndDate) {
                        finalEndDate = oSelectedEndDate;  // User selected date
                    } else {
                        var oJoiningDate = new Date(oTraineeModel.JoiningDate);  // Calculate End Date
                        var trainingDuration = oTraineeModel.TrainingDuration;
                        var monthsMatch = trainingDuration.match(/(\d+)/);
                        var months = monthsMatch ? parseInt(monthsMatch[0]) : 0;

                        var oCalculatedEndDate = new Date(oJoiningDate);
                        oCalculatedEndDate.setMonth(oCalculatedEndDate.getMonth() + months);
                        oCalculatedEndDate.setDate(oCalculatedEndDate.getDate() - 1);
                        finalEndDate = oCalculatedEndDate;
                    }

                    function formatDateLocal(date) {
                        var year = date.getFullYear();
                        var month = String(date.getMonth() + 1).padStart(2, '0');
                        var day = String(date.getDate()).padStart(2, '0');
                        return `${year}-${month}-${day}`;
                    }

                    var formattedEndDate = formatDateLocal(finalEndDate);
                    this.getView().getModel("PDFData").setProperty("/CreateDate", Formatter.formatDate(new Date()));
                    this.getView().getModel("PDFData").setProperty("/CertificateTitle", `${oTraineeModel.TraineeName} - Trainee Certificate`);
                    // Create the updated trainee data
                    const oUpdatedData = {
                        ID: oTraineeModel.ID,
                        TraineeID: oTraineeModel.TraineeID,
                        Department: sap.ui.getCore().byId("TCF_id_Department").getSelectedKey(),
                        ProjectName: oTraineeModel.ProjectName,
                        EndDate: formattedEndDate, 
                        Role: "Trainee",
                        Status: "Training Completed"
                    };
                    await this.updateCallForTrainee(oUpdatedData, "pdfDownloading");
                    await this.T_onSearch();
                    this.byId("T_id_TraineeTable").removeSelections(true);
                    this.byId("T_id_Download").setVisible(false);
                    this.getView().getModel("PDFData").setProperty("/PreviewFlag", false);
                    let htmlContent = sap.ui.getCore().byId("myRTE").getValue();
                    this.TC_oDialog.close();
                    this.T_ButtonVisibility();
                    this.closeBusyDialog();
                    this.getView().getModel("PDFData").setProperty("/RTEText", "<p>Please click on <b>Preview</b> to Preview the Certificate</p>");
                    this.generateCertificatePDF(htmlContent, oTraineeModel.BranchCode);
                } catch (error) {
                    this.closeBusyDialog();
                    MessageToast.show(error.message || error.responseText);
                }
            },

            

            
            //Trainee onboard function        
            T_onBoardTrainee: function () {
                var oSelectedItem = this.byId("T_id_TraineeTable").getSelectedItem();
                var oTraineeModel = oSelectedItem.getBindingContext("traineeModel").getObject();
                this.getRouter().navTo("RouteEmployeeOfferDetails", {
                    sParOffer: oTraineeModel.TraineeName,
                    sParEmployee: oTraineeModel.NameSalutation
                });
            },
            T_onSearch: async function () {
                try {
                    this.getBusyDialog();

                    const filterItems = this.byId("T_id_Filterbar").getFilterGroupItems();
                    const params = {};
                    let joiningDateProvided = false;

                    // Extract values from filter items
                    filterItems.forEach((item) => {
                        const control = item.getControl();
                        const key = item.getName();

                        if (control && typeof control.getValue === "function") {
                            const value = control.getValue().trim();
                            if (value) {
                                params[key] = value;
                            }
                        }

                        if (key === "JoiningDate" && control?.getDateValue() && control?.getSecondDateValue()) {
                            const oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
                                pattern: "yyyy-MM-dd"
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
                        delete params.startDate;
                        delete params.endDate;
                        delete params.FinancialYear;
                        this._isClearPressed = false;
                    } else {
                        const startDate = new Date(params.startDate);
                        const endDate = new Date(params.endDate);
                        if (
                            startDate.getTime() === fyStart.getTime() &&
                            endDate.getTime() === fyEnd.getTime()
                        ) {
                            params.FinancialYear = financialYearLabel;
                        }
                    }

                    // Fetch initial data to get unique trainee names
                    await this._fetchCommonData("Trainee", "traineeNameModel", {
                        startDate: params.startDate,
                        endDate: params.endDate
                    });

                    const oInitialModel = this.getView().getModel("traineeNameModel");
                    const aInitialData = oInitialModel.getData();
                    const uniqueTrainees = [];
                    const seenNames = new Set();
                    aInitialData.forEach(item => {
                        if (item.TraineeName && !seenNames.has(item.TraineeName)) {
                            seenNames.add(item.TraineeName);
                            uniqueTrainees.push(item);
                        }
                    });
                    oInitialModel.setData(uniqueTrainees);

                    // Fetch filtered data
                    await this._fetchCommonData("Trainee", "traineeModel", params);
                    this.T_ButtonVisibility();
                    this.T_Button();
                    this.closeBusyDialog();
                } catch (error) {
                    this.closeBusyDialog();
                    MessageToast.show(this.i18nModel.getText("technicalError"));
                }
            },
            //clear the filterbar
            T_onPressClear: async function () {
                var aFilterItems = this.byId("T_id_Filterbar").getFilterGroupItems();
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
            //Traniee certificate mail function
            T_onCerMail: async function () {
                try {
                    this.getBusyDialog();
                    await this._fetchCommonData("EmailContent", "CCMailModel", {
                        Type: "TraineeCertificate",
                        Action: "CC"
                    });
                    var oTraineeEmail = this.byId("T_id_TraineeTable").getSelectedItem().getBindingContext("traineeModel").getObject().TraineeEmail;
                    if (!oTraineeEmail || oTraineeEmail.length === 0) {
                        MessageBox.error("To Email is missing");
                        return;
                    }
                    var oUploaderDataModel = new JSONModel({
                        isEmailValid: true,
                        ToEmail: oTraineeEmail,
                        CCEmail: this.getView().getModel("CCMailModel").getData()[0].CCEmailId,
                        name: "",
                        mimeType: "",
                        content: "",
                        isFileUploaded: false,
                        button: false
                    });
                    this.getView().setModel(oUploaderDataModel, "UploaderData");
                    this.T_commonOpenDialog("T_MailDialog", "sap.kt.com.minihrsolution.fragment.CommonMail");
                    this.validateSendButton();
                    this.closeBusyDialog();;
                } catch (error) {
                    MessageToast.show(this.i18nModel.getText("technicalError"));
                }
            },
            //Close the mail dialog function
            Mail_onPressClose: function () {
                try {
                    if (this.T_MailDialog) {
                        this.T_MailDialog.destroy();
                        this.T_MailDialog = null;
                    }
                    this.T_ButtonVisibility();
                    this.T_Button();
                } catch (error) {
                    MessageToast.show(this.i18nModel.getText("technicalError"));
                }
            },
            //Handle the file upload function
            Mail_onUpload: function (oEvent) {
                this.handleFileUpload(
                    oEvent, this,
                    "UploaderData", "/attachments", "/name", "/isFileUploaded", "uploadSuccessfull", "fileAlreadyUploaded", "noFileSelected", "fileReadError",
                    () => this.validateSendButton()
                );
            },
            //validation for send button
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

            //validation for email change        
            Mail_onEmailChange: function () {
                this.validateSendButton();
            },
            //send mail function
            Mail_onSendEmail: function () {
                try {
                    var oModel = this.byId("T_id_TraineeTable").getSelectedItem().getBindingContext("traineeModel").getObject();
                    var aAttachments = this.getView().getModel("UploaderData").getProperty("/attachments");
                    if (!aAttachments || aAttachments.length === 0) {
                        MessageToast.show(this.i18nModel.getText("attachmentRequired"));
                        return;
                    }
                    var oPayload = {
                        "TraineeName": oModel.TraineeName,
                        "toEmailID": oModel.TraineeEmail,
                        "CC": sap.ui.getCore().byId("CCMail_TextArea").getValue(),
                        "attachments": this.getView().getModel("UploaderData").getProperty("/attachments"),
                    };
                    this.getBusyDialog();
                    this.ajaxCreateWithJQuery("TraineeCertificateEmail", oPayload).then((oData) => {
                        MessageToast.show(this.i18nModel.getText("certificateSuccess"));
                        this.byId("T_id_TraineeTable").removeSelections(true);
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
            getGroupHeader: function (oGroup) {
                return this.getStyledGroupHeader(oGroup);
            },
            T_DownloadTableData: function () {
                var table = this.byId("T_id_TraineeTable");
                const oModelData = table.getModel("traineeModel").getData();
                const aFormattedData = oModelData.map(item => {
                    return {
                        ...item,
                        JoiningDate: Formatter.formatDate(item.JoiningDate),
                    };
                });
                const aCols = [
                    { label: this.i18nModel.getText("traineeId"), property: "TraineeID", type: "string" },
                    { label: this.i18nModel.getText("salutation"), property: "NameSalutation", type: "string" },
                    { label: this.i18nModel.getText("traineeName"), property: "TraineeName", type: "string" },
                    { label: this.i18nModel.getText("emailId"), property: "TraineeEmail", type: "string" },
                     { label: this.i18nModel.getText("managerId"), property: "ManagerID", type: "string" },
                    { label: this.i18nModel.getText("reportingManager"), property: "ReportingManager", type: "string" },
                    { label: this.i18nModel.getText("joiningDate"), property: "JoiningDate", type: "string" },
                    { label: this.i18nModel.getText("durationT"), property: "TrainingDuration", type: "string" },
                    { label: this.i18nModel.getText("type"), property: "Type", type: "string " },
                    { label: this.i18nModel.getText("amount"), property: "Amount", type: "string" },
                    { label: this.i18nModel.getText("baseLocation"), property: "BaseLocation", type: "string" },
                ];
                const oSettings = {
                    workbook: {
                        columns: aCols,
                        context: {
                            sheetName: this.i18nModel.getText("traineeDetails")
                        }
                    },
                    dataSource: aFormattedData,
                    fileName: "Trainee_Details.xlsx"
                };
                const oSheet = new Spreadsheet(oSettings);
                oSheet.build().then(function () {
                    MessageToast.show(this.i18nModel.getText("downloadsuccessfully"));
                }.bind(this)).finally(function () {
                    oSheet.destroy();
                });
            },

            T_onResendOnboardingEmail: function () {
                var oTable = this.byId("T_id_TraineeTable");
                var oSelectedItem = oTable.getSelectedItem();

                if (!oSelectedItem) return MessageToast.show("Please select one record.");

                var oData = oSelectedItem.getBindingContext("traineeModel").getObject();

                this.getBusyDialog();

                this.ajaxCreateWithJQuery("TraineeOnboardEmail", {
                    "TraineeID": oData.TraineeID,
                    "TraineeName": oData.TraineeName,
                    "CompanyEmail": oData.CompanyEmailID,
                    "toEmailID": [oData.CompanyEmailID],
                    "flag": "X"
                })
                    .then((response) => {
                        this.closeBusyDialog();
                        MessageToast.show("Onboarding email sent successfully.");
                        this.byId("T_id_ResendEmail").setEnabled(false);
                        this.byId("T_id_TraineeTable").removeSelections(true);
                        this.byId("T_id_Download").setVisible(false);
                    })
                    .catch((error) => {
                        this.closeBusyDialog();
                        MessageToast.show(error.message || error.responseText || "Error while sending email.");
                    });
            }

        });
    });