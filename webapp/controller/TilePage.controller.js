sap.ui.define(
    [
        "./BaseController",
        "sap/m/MessageToast",
        "../utils/validation",
        "sap/ui/model/json/JSONModel"
    ],
    function (BaseController, MessageToast, utils, JSONModel) {
        "use strict";
    const $C = (id) => sap.ui.getCore().byId(id);

        return BaseController.extend(
            "sap.kt.com.minihrsolution.controller.TilePage", {
            onInit: function () {
                this._autoScrollTimer = null;
                this.getRouter().getRoute("RouteTilePage").attachMatched(this._onRouteMatched, this);
            },
            onExit: function () {
                // 3. Final, essential cleanup
                if (this._autoScrollTimer) {
                    clearInterval(this._autoScrollTimer);
                }
            },
            _onRouteMatched: async function () {
                  var model = new JSONModel({ RaiseVisible: false});
                  this.getView().setModel(model, "VisibleModel");
                if (!this.that)
                    this.that = this.getOwnerComponent().getModel("ThisModel")?.getData().that;
                var LoginFunction = await this.commonLoginFunction("TilePage");
                if (!LoginFunction) return;
                this.scrollToSection("id_ObjectPageLayoutTile", "id_Sectiontile");
                this.getBusyDialog();
                this.i18nModel = this.getView().getModel("i18n").getResourceBundle();
                this.byId("id_ObjectPageLayoutTile").setSelectedSection('0');
                
                await this.AppVisibilityReadCall();
                var LoginModel = this.getView().getModel("LoginModel");



                let count = await this.ajaxReadWithJQuery("InboxDetailsSubmittedCount", { ManagerID: LoginModel.getProperty("/EmployeeID") });
                this.getView().getModel("TileAccessModel").setProperty("/SubmittedCount", count.submittedCount)


                // Set default value outside
                var oEndingSoonModel = new JSONModel({ "notificationCount": 0 });
                this.getOwnerComponent().setModel(oEndingSoonModel, "EndingSoonModel");
                // Check role
                if (LoginModel.getProperty("/Role") === "Admin") {
                    let data = await this.ajaxReadWithJQuery("getDashboardEndingSoonSummary", {});
                    // Update value after API call
                    oEndingSoonModel.setProperty("/notificationCount", data.data);
                }

                await this._fetchCommonData("AllLoginDetails", "EmpModel");
                await this._fetchCommonData("EmployeeDetails", "EmpDetails");
                await this._fetchCommonData("Trainee", "traineePayslipModel", { Type: "Stipend" });
           
                this.CreateEmployeeModel();
                this.initializeBirthdayCarousel();

                var model = new JSONModel({
                    AppName: "",
                    BugDescription: "",
                    RaisedBy: LoginModel.getProperty("/EmployeeName"),
                    Email: "",
                    attachments: [],
                    tokens: [],
                    Submit: true,
                    Save: false
                });
                this.getView().setModel(model, "RaiseBugModel")
                
        
            },
            CreateEmployeeModel: function () {
                var empData = this.getView().getModel("EmpDetails").getData() || [];
                var filteredEmpData = empData.filter(function (item) {
                    return item.Role !== "Contractor" && item.Role !== "Trainee";
                });
                var traineeData = this.getView().getModel("traineePayslipModel").getData() || [];
                var filteredTrainees = traineeData.filter(function (item) {
                    return item.Status === "Onboarded" || item.Status === "Training Completed";
                });
                var normalizedTrainees = filteredTrainees.map(function (item) {
                    return {
                        EmployeeID: item.TraineeID,
                        EmployeeName: item.TraineeName
                    };
                });
                var combinedData = filteredEmpData.concat(normalizedTrainees);
                var oFilteredModel = new sap.ui.model.json.JSONModel(combinedData);
                this.getOwnerComponent().setModel(oFilteredModel, "EmployeeModel");
            },
            AppVisibilityReadCall: async function () {
                try {
                    const oLoginModel = this.getView().getModel("LoginModel");
                    if (!oLoginModel) return;

                    const { Role } = oLoginModel.getData();
                    const oData = await this.ajaxReadWithJQuery("AppVisibility", { Role }, []);
                    this.closeBusyDialog();

                    const firstEntry = Array.isArray(oData.data) ? oData.data[0] : oData.data;
                    this.getOwnerComponent().setModel(new JSONModel(firstEntry), "AppVisibilityModel");

                    const tileNames = ["Home", "Timesheet", "Payslip", "OfferGeneration", "Invoice", "Quotation", "Expense", "ManageAsset", "Recruitment",];

                    const tileKeys = firstEntry.TileKey?.split(",") || [];
                    const tileMapping = tileNames.reduce((map, name, i) => {
                        map[name] = tileKeys[i] || "0";
                        return map;
                    }, {});

                    this.getView().setModel(new JSONModel(tileMapping), "TileAccessModel");
                } catch (oError) {
                    MessageToast.show("Error in AppVisibilityReadCall");
                }
            },
            RP_onUseridpress: function (oEvent) {
                utils._LCvalidateMandatoryField(oEvent);
            },
            RP_onUsername: function (oEvent) {
                utils._LCvalidateName(oEvent);
            },
            RP_onChangnewpass: function (oEvent) {
                utils._LCvalidatePassword(oEvent);
                this._addPasswordGenerateIcon()
            },
            RP_onChangcomfirmpass: function (oEvent) {
                utils._LCvalidateMandatoryField(oEvent);
            },
            RP_onSelectUser: function () {
                var that = this;
                var oEmpCombo = sap.ui.getCore().byId("RP_id_userid"); // User ID input field
                var selectedKey = oEmpCombo.getSelectedKey(); // Get selected user ID

                if (!selectedKey) {
                    oEmpCombo.setValueState("Error");
                    return;
                } else {
                    oEmpCombo.setValueState("None");
                }
                var oEmpModel = this.getView().getModel("EmpModel"); // Fetch employee model
                if (!oEmpModel) {
                    MessageToast.show(that.i18nModel.getText("noemp"));
                    return;
                }
                var aEmployees = oEmpModel.getProperty("/"); // Get employee data array
                // Find selected employee by EmployeeID
                var selectedEmployee = aEmployees.find(function (emp) {
                    return emp.EmployeeID === selectedKey;
                });
                if (selectedEmployee) {
                    // Ensure FragmentModel exists
                    var oFragmentModel = this.getView().getModel("FragmentModel");
                    if (!oFragmentModel) {
                        oFragmentModel = new JSONModel({});
                        this.getView().setModel(oFragmentModel, "FragmentModel");
                    }
                    // Set EmployeeID and EmployeeName in the model
                    oFragmentModel.setProperty(
                        "/EmployeeID",
                        selectedEmployee.EmployeeID
                    );
                    oFragmentModel.setProperty(
                        "/EmployeeName",
                        selectedEmployee.EmployeeName
                    );
                    // Automatically populate the username field
                    var oUserNameInput = sap.ui.getCore().byId("RP_id_userName");
                    oUserNameInput.setValue(selectedEmployee.EmployeeName);
                    oUserNameInput.setValueState("None");
                    // Clear password fields
                    sap.ui.getCore().byId("RP_id_NewPW").setValue("").setValueState("None");
                    sap.ui.getCore().byId("RP_id_ConfirmPW").setValue("").setValueState("None");
                } else {
                    MessageToast.show(that.i18nModel.getText("empnotfound"));
                }
            },
          
            SM_onGenerateForgotPassword: function () {
            var oPwdInput = $C("RP_id_NewPW");
            if (!oPwdInput) return;

            var pwd = utils._LCgenerateStrongPassword();
            oPwdInput.setValue(pwd).setValueState("None");
            this._addPasswordGenerateIcon()
        
        },
         _addPasswordGenerateIcon: function () {
            const aInputs = [$C("RP_id_NewPW")];

            aInputs.forEach((oInput) => {
                if (!oInput || oInput._hasCopyIcon) return;
                oInput.addEndIcon({
                    src: "sap-icon://copy",
                    tooltip: "Copy password",
                    press: this.SM_onCopyPassword.bind(this)
                });
                oInput._hasCopyIcon = true;
            });
        },
         SM_onCopyPassword: function (oEvent) {
            const oIcon = oEvent.getSource();
            const oInput = oIcon.getParent(); // 👈 actual input owning the icon
            if (!oInput || !oInput.getValue) return;
            const pwd = oInput.getValue();
            if (!pwd) return sap.m.MessageToast.show(this.i18nModel.getText("noPasswordCopy"));

            navigator.clipboard.writeText(pwd)
                .then(() => {
                    MessageToast.show(this.i18nModel.getText("passwordCopied"));
                })
                .catch(() => {
                    try {
                        const oTemp = document.createElement("textarea");
                        oTemp.value = pwd;
                        document.body.appendChild(oTemp);
                        oTemp.select();
                        document.execCommand("copy");
                        document.body.removeChild(oTemp);
                        MessageToast.show(this.i18nModel.getText("passwordCopied"));
                    } catch (err) {
                        MessageToast.show(this.i18nModel.getText("copyFailed"));
                    }
                });
        },
            TP_onupdatepress: function () {
                var oView = this.getView();
                // Ensure user selection is reset before opening
                var oFragmentModel = this.getView().getModel("FragmentModel");
                if (oFragmentModel) {
                    oFragmentModel.setData({
                        EmployeeID: "",
                        EmployeeName: ""
                    });
                }
                if (!this.oUpdatePass) {
                    sap.ui.core.Fragment.load({
                        name: "sap.kt.com.minihrsolution.fragment.ResetPassword",
                        controller: this,
                    }).then(
                        function (oUpdatePass) {
                            this.oUpdatePass = oUpdatePass;
                            oView.addDependent(this.oUpdatePass);
                            this.oUpdatePass.open();
                        }.bind(this)
                    );
                } else {
                    this.oUpdatePass.open();
                }
            },
            RP_onPressCanclePW: function () {
                sap.ui.getCore().byId("RP_id_userid").setValue("").setSelectedKey("").setValueState("None");
                sap.ui.getCore().byId("RP_id_userid").setSelectedKey(null);
                var oUserNameInput = sap.ui.getCore().byId("RP_id_userName");
                // Reset all input fields
                oUserNameInput.setValue("");
                oUserNameInput.setValueState("None");
                sap.ui.getCore().byId("RP_id_NewPW").setValue("").setValueState("None");
                sap.ui.getCore().byId("RP_id_ConfirmPW").setValue("").setValueState("None");
                // Close dialog
                if (this.oUpdatePass) {
                    this.oUpdatePass.close();
                }
            },
            RP_onPressSetSave: async function () {
                const oUserIdInput = sap.ui.getCore().byId("RP_id_userid");
                const oUserNameInput = sap.ui.getCore().byId("RP_id_userName");
                const oNewPwInput = sap.ui.getCore().byId("RP_id_NewPW");
                const oConfirmPwInput = sap.ui.getCore().byId("RP_id_ConfirmPW");
                const frgUserId = oUserIdInput.getValue();
                const newPassword = oNewPwInput.getValue();
                const confirmPassword = oConfirmPwInput.getValue();
                // Validate inputs
                if (
                    !utils._LCvalidateMandatoryField(oUserIdInput, "ID") ||
                    !utils._LCvalidateName(oUserNameInput, "ID") ||
                    !utils._LCvalidatePassword(oNewPwInput, "ID") ||
                    !utils._LCvalidateMandatoryField(oConfirmPwInput, "ID")
                ) {
                    MessageToast.show(this.i18nModel.getText("mandetoryFields"));
                    return;
                }
                if (newPassword !== confirmPassword) {
                    sap.ui.getCore().byId("RP_id_ConfirmPW").setValueState("Error");
                    MessageToast.show(this.i18nModel.getText("misPasswords"));
                    return;
                }
                try {
                    this.getBusyDialog();
                    const response = await this.ajaxUpdateWithJQuery("LoginDetails", {
                        data: {
                            Password: btoa(newPassword),
                        },
                        filters: {
                            EmployeeID: frgUserId,
                        },
                    });
                    if (response.success === true) {
                        this.closeBusyDialog();
                        sap.ui.getCore().byId("RP_id_userid").setSelectedKey(null);
                        sap.ui.getCore().byId("RP_id_ConfirmPW").setValueState("None");
                        oUserIdInput.setValue("");
                        oUserNameInput.setValue("");
                        oNewPwInput.setValue("");
                        oConfirmPwInput.setValue("");
                        const oModel = this.getView().getModel("EmpModel");
                        if (oModel) {
                            oModel.refresh(true);
                        }
                        if (this.oUpdatePass) {
                            this.oUpdatePass.close();
                        }
                        MessageToast.show(this.i18nModel.getText("updatepassword"));
                    } else {
                        MessageToast.show("Failed to update password.");
                    }
                } catch (err) {
                    MessageToast.show("An error occurred: " + err.message);
                }
            },
            RP_onComPass: function () {
                const oNewPwInput = sap.ui.getCore().byId("RP_id_NewPW");
                const oConfirmPwInput = sap.ui.getCore().byId("RP_id_ConfirmPW");
                const newPassword = oNewPwInput.getValue();
                const confirmPassword = oConfirmPwInput.getValue();
                if (newPassword !== confirmPassword) {
                    sap.ui.getCore().byId("RP_id_ConfirmPW").setValueState("Error");
                    MessageToast.show(this.i18nModel.getText("misPasswords"));
                    return;
                } else {
                    sap.ui.getCore().byId("RP_id_ConfirmPW").setValueState("None");
                }
            },
            //password visibility change
            RP_onTogglePasswordVisibility: function (oEvent) {
                var oInput = oEvent.getSource();
                var sType = oInput.getType() === "Password" ? "Text" : "Password";
                oInput.setType(sType);
                // Toggle the value help icon properly without losing the value
                var sIcon =
                    sType === "Password" ? "sap-icon://show" : "sap-icon://hide";
                oInput.setValueHelpIconSrc(sIcon);

                // Ensure the current value of the password is retained
                var sCurrentValue = oInput.getValue(); // Get the current value before toggling
                oInput.setValue(sCurrentValue);
            },
            TileV_onpressTrainee: function () {
                this.getRouter().navTo("RouteTrainee", {
                    value: "Trainee",
                    from : "TilePage"
                });
            },
            TileV_onPressOffer: function () {
                //this.getBusyDialog();
                this.getRouter().navTo("RouteEmployeeOffer", {
                    valueEmp: "EmployeeOffer",
                    from : "TilePage"
                });
            },
            TileV_onpresslistofholidays: function () {
                this.getRouter().navTo("RouteListofholidays");
            },
            TileV_onpressIDCARD: function () {
                this.getRouter().navTo("RouteIDCardApplication");
            },
            TileV_onpressLeave: function () {
                this.getRouter().navTo("RouteAdminApplyLeave");
            },
            TileV_onpresscompoff: function () {
                this.getRouter().navTo("RouteCompOff");
            },
            TileV_onpressConsultantInvoice: function () {
                this.getRouter().navTo("RouteConsultantInvoiceApplication",{
                    from:"Tilepage"
                });
            },
            TileV_onpressContract: function () {
                this.getRouter().navTo("RouteContract", {
                    valueEmp: "Contract",
                    from : "TilePage"
                });
            },
            TileV_onPressAdminPaySlip: function () {
                this.that.getBusyDialog();
                this.getRouter().navTo("RouteAdminPaySlip",{
                    from:"Tilepage"
                });
            },
            TileV_onpressSelfservice: function () {
                this.getRouter().navTo("SelfService", {
                    sPath: "SelfService",
                    Role: "Role",
                });
            },
            TileV_onpressInbox: function () {
                this.getRouter().navTo("RouteMyInbox", {
                    sMyInBox: "MyInboxView"
                });
            },
            TileV_onpressInvoiceApp: function () {
                this.getRouter().navTo("RouteCompanyInvoice", {
                    FileName: "CompanyInvoice"
                });
            },
            TileV_onpressQuotation: function () {
                sap.ui.core.BusyIndicator.show(0);
                this.getRouter().navTo("RouteQuotation");
            },
            TileV_onpressAssignment: function () {
                this.getRouter().navTo("RouteManageAssignment");
            },
            TileV_onpresstimesheet: function () {
                this.getRouter().navTo("RouteTimesheet");
            },
            TileV_onPressTimesheetApp: function () {
                this.getRouter().navTo("RouteTimesheetApproval");
            },
            TileV_onPressGenerateSalary: function () {
                this.getRouter().navTo("RouteGenerateSalary");
            },
            TileV_onPressManagePayroll: function () {
                this.getRouter().navTo("RouteManagePayroll");
            },
            TileV_onpressEmployeeDetails: function () {
                this.getRouter().navTo("RouteEmployeeDetails", {
                    sPath: "EmployeeDetails",
                });
            },
            TileV_onBackPress: function () {
                this.CommonLogoutFunction();
            },
            TileV_onpressAddCustomer: function () {
                this.getRouter().navTo("RouteManageCustomer", {
                    value: "ManageCustomer",
                });
            },
            TileV_onpressMSA: function () {
                this.getRouter().navTo("RouteMSA",{
                    from:"Tilepage"
                });
            },
            TileV_onpressExpenseApp: function () {
                // this.getBusyDialog();
                this.getRouter().navTo("RouteExpensePage",{
                    FileName: "ExpenseApplication"
                });
            },
            TileV_onPressManageSchemeUpload: function () {
                this.getRouter().navTo("RouteSchemeUpload", {
                    value: "SchemeUpload",
                });
            },
            TileV_onPressIncomeAsset: function () {
                this.getRouter().navTo("RouteIncomeAsset",{
                    from: "TilePage"
                });
            },
            TileV_onPressAssetAssignment: function () {
                this.getRouter().navTo("RouteAssetAssignment",{
                    asset: "AssetAssignment"
                });
            },
            TileV_onPressHrQuotation: function () {
                this.getRouter().navTo("RouteHrQuotation",{
                    from:"Tilepage"
                });
            },
            TileV_MyAsset: function () {
                this.getRouter().navTo("MyAsset");
            },
            TileV_onpressPoApp: function () {
                this.getRouter().navTo("PurchaseOrder",{
                    fileName: "NewPurchaseOrder",
                    from:"PurchaseOrder"
                });
            },
            TileV_Recruitment: function () {
                this.getRouter().navTo("Recruitment");
            },
            TileV_RecruitementDashbord: function () {
                this.getRouter().navTo("AppliedCandidates",{
                 value: "Candidates"
                });
            },
            TileV_JobPosting: function () {
                this.getRouter().navTo("RouteHP_View");
            },
            TileV_onpressInvoiceDashboard: function () {
                this.getRouter().navTo("RouteInvoiceDashboard");
            },
            TileV_onpressExpenseInvoiceDashboard: function () {
                this.getRouter().navTo("ExpenseInvoice",{
                    from:"Tilepage"
                });
            },
            TileV_onpressAllowanceApp: function () {
                this.getRouter().navTo("RouteAllowancePage",{
                    from:"Tilepage"
                });
            },
            TileV_onpressSendGreetings: function () {
                this.getRouter().navTo("RouteSendGreetings");
            },
            TileV_onpressLeaveOverview: function () {
                this.getRouter().navTo("RouteLeaveOverview");
            },
            TileV_onpressCreditNoteApp: function () {
                this.getRouter().navTo("RouteCreditNote",{
                    FileName: "CreditNote"
                });
            },
            TileV_onpressBugRaiseVendor: function () {
                this.getRouter().navTo("RouteRaiseBug");
            },
            TileV_onpressCreateAllowanceApp: function () {
                this.getRouter().navTo("RouteCreateAllowance");
            },
            TileV_onPressPaySlipDeduction: function () {
                this.getRouter().navTo("RoutePayslipDeduction");
            },
            onTileRefresh: async function () {
                this.getBusyDialog();
                const backendModels = {
                    EmpModel: "EmployeeDetails",
                    traineeModel: "Trainee",
                    EmailContent: "AppVisibility",
                    LeaveModel: "Leaves",
                    LeaveTypeModel: "Leaves"
                };
                await Promise.allSettled(
                    Object.entries(backendModels).map(([model, entity]) =>
                        this._fetchCommonData(entity, model).catch(err => {
                            console.warn(`Failed fetching: ${entity} → ${model}`, err);
                        })
                    )
                );
                this.closeBusyDialog();
                MessageToast.show("Users accounts synchronized");
            },
            UploadCountryData: function () {
                let oView = this.getView()
                if (!this.oLeaveDialog) {
                    sap.ui.core.Fragment.load({
                        name: "sap.kt.com.minihrsolution.fragment.AddHolidayList",
                        controller: this,
                    }).then(function (oLeaveDialog) {
                        this.oLeaveDialog = oLeaveDialog;
                        oView.addDependent(this.oLeaveDialog);
                        this.oLeaveDialog.setTitle("Upload country data");
                        this.oLeaveDialog.open();
                        sap.ui.getCore().byId("ALH_id_Date").setVisible(false);
                        sap.ui.getCore().byId("ALH_id_fileuploaderLabele").setRequired(false);

                    }.bind(this));
                } else {
                    // this._resetDialogFields();
                    this.oLeaveDialog.open();
                    this.oLeaveDialog.setTitle("Upload country data");
                    sap.ui.getCore().byId("ALH_id_Date").setVisible(false);
                    sap.ui.getCore().byId("ALH_id_fileuploaderLabele").setRequired(false);

                }
            },
            LOH_onPressClose: function () {
                sap.ui.getCore().byId("ALH_id_LocFileUpload").setValue("");
                this.oLeaveDialog.close();
                this.oLeaveDialog.destroy();
                this.oLeaveDialog = null;
            },
            LOH_onUpload: function (oEvent) {
                var oFile = oEvent.getParameter("files")[0];
                if (oFile) {
                    var reader = new FileReader();

                    reader.onload = function (e) {
                        // Convert file into array buffer
                        var data = new Uint8Array(e.target.result);

                        // Read workbook
                        var workbook = XLSX.read(data, {
                            type: 'array'
                        });

                        // Take first sheet
                        var sheetName = workbook.SheetNames[0];
                        var sheet = workbook.Sheets[sheetName];

                        // Convert sheet → JSON
                        this.jsonData = XLSX.utils.sheet_to_json(sheet, {
                            defval: ""
                        });

                        // console.log("Excel JSON Data:", this.jsonData);

                    }.bind(this);

                    reader.readAsArrayBuffer(oFile);
                }
            },
            LOH_onPressSubmit: function () {
                let that = this
                let stdcodeavlue = sap.ui.getCore().byId("TP_id_STDCode").getValue();
                let currencyavlue = sap.ui.getCore().byId("TP_id_Currency").getValue();
                let branchcodevlue = sap.ui.getCore().byId("TP_id_BranchCode").getValue();
                let cityvlue = sap.ui.getCore().byId("TP_id_City").getValue();
                let statevlue = sap.ui.getCore().byId("TP_id_State").getValue();
                let countryavlue = sap.ui.getCore().byId("TP_id_Country").getValue();
                let countrycode = sap.ui.getCore().byId("TP_id_CountryCode").getValue();

                const formData = {
                    city: cityvlue,
                    branchCode: branchcodevlue,
                    state: statevlue,
                    CountryCode: countrycode,
                    Country: countryavlue,
                    STDCode: stdcodeavlue,
                    Currency: currencyavlue
                }

                if (this.jsonData) {
                    if (this.jsonData.length <= 0) {
                        sap.m.MessageToast.show("Fill is empty");
                        return;
                    }
                    this.sendExcelfileData = this.jsonData;
                } else {
                    this.sendExcelfileData = formData
                    if (this.sendExcelfileData.city === "" ||
                        this.sendExcelfileData.state === "" || this.sendExcelfileData.CountryCode === "" || this.sendExcelfileData.Country === "" ||
                        this.sendExcelfileData.STDCode === "" || this.sendExcelfileData.Currency === "") {
                        sap.m.MessageToast.show("Please Fill Data");
                        return;
                    }
                }
                const datafromexcel = {
                    data: this.sendExcelfileData
                };
                that.getBusyDialog();
                that.ajaxCreateWithJQuery("BaseLocation", datafromexcel).then((res) => {
                    that.closeBusyDialog();
                    sap.ui.getCore().byId("ALH_id_LocFileUpload").setValue("");
                    that.LOH_onPressClose();
                    sap.m.MessageToast.show("Data saved successfully");
                }).catch((error) => {
                    sap.m.MessageToast.show("Duplicate data in file");
                    that.closeBusyDialog();
                });
            },
            onDownloadTemplatexlsx: function () {
                let fileUrl = window.location.origin.split("index")[0] + "/Template.xlsx";
                sap.m.URLHelper.redirect(fileUrl, true)
            },
            TileV_MaintainData: function () {
                this.getRouter().navTo("MaintainData");
            },

            TP_onraisebugpress: function () {
                if (!this._RaiseBugDialog) {

                    sap.ui.core.Fragment.load({
                        id: this.getView().getId(),
                        name: "sap.kt.com.minihrsolution.fragment.RaiseBug",
                        controller: this
                    }).then(function (oDialog) {
                        this._RaiseBugDialog = oDialog;
                        this.getView().addDependent(oDialog);
                        oDialog.open();
                        this._RaiseBugDialog.attachAfterClose(() => {
                            this.RB_onCancelButtonPress();
                        });
                    }.bind(this));
                } else {
                    this._RaiseBugDialog.open();
                }
                this.getView().getModel("RaiseBugModel").setProperty("/RaisedBy",this.getView().getModel("LoginModel").getProperty("/EmployeeName"));
            },

            RB_onCancelButtonPress: function () {
                const oView = this.getView();
                // 1️⃣ Clear model data
                const oBugModel = oView.getModel("RaiseBugModel");
                if (oBugModel) oBugModel.setData({ AppName: "", BugDescription: "", Email: "",Save:false });

                if (oBugModel) oBugModel.setProperty("/attachments", []);

                if (oBugModel) oBugModel.setProperty("/tokens", []);

                // 4️⃣ Reset ValueState
                const aFields = ["RB_id_appname", "RB_id_bugDescription", "RB_id_RaisedBy", "RB_id_Email","RB_id_type"];

                aFields.forEach(id => {
                    const oControl = sap.ui.getCore().byId(oView.createId(id));
                    if (oControl) oControl.setValueState("None");
                });

                // 5️⃣ Clear file uploader
                const oUploader = sap.ui.getCore().byId(oView.createId("RB_id_FileUploader1"));
                if (oUploader) oUploader.clear();



                // 6️⃣ Close dialog
                this._RaiseBugDialog.close();
            },
            onAppnamechanges: function (oEvent) {
                utils._LCstrictValidationComboBox(oEvent)
            },
              ontypenamechanges: function (oEvent) {
                utils._LCstrictValidationComboBox(oEvent)
            },
            onBugdescriptionchnages: function (oEvent) {
                utils._LCvalidateMandatoryField(oEvent)
            },
            onBugRaisedby: function (oEvent) {
                utils._LCvalidateMandatoryField(oEvent)
            },
            onBugEmailchange: function (oEvent) {
                utils._LCstrictValidationComboBox(oEvent)
                var oSelectedItem = oEvent.getSource().getSelectedItem();

                if (oSelectedItem) {
                    this.getView().getModel("RaiseBugModel").setProperty("/Email", oSelectedItem.getAdditionalText());
                }
            },

            onBugSubmit: async function () {
                const oView = this.getView();
                const oBugModel = oView.getModel("RaiseBugModel").getData();

                const aAttachments = oView.getModel("RaiseBugModel").getProperty("/attachments") || [];

                let photoPayload = {
                    Photo1: "", Photo1Name: "", Photo1Type: "",
                    Photo2: "", Photo2Name: "", Photo2Type: "",
                    Photo3: "", Photo3Name: "", Photo3Type: ""
                };

                // ✅ VALIDATION
                var isMandatoryValid = (
                    utils._LCstrictValidationComboBox(sap.ui.getCore().byId(oView.createId("RB_id_appname")), "ID") &&
                    utils._LCstrictValidationComboBox(sap.ui.getCore().byId(oView.createId("RB_id_type")), "ID") &&
                    utils._LCvalidateMandatoryField(sap.ui.getCore().byId(oView.createId("RB_id_bugDescription")), "ID") &&
                    utils._LCvalidateMandatoryField(sap.ui.getCore().byId(oView.createId("RB_id_RaisedBy")), "ID") &&
                    utils._LCstrictValidationComboBox(sap.ui.getCore().byId(oView.createId("RB_id_Email")), "ID")
                );

                if (!isMandatoryValid) {
                    return MessageToast.show(this.i18nModel.getText("mandetoryFields"));
                }

                // ✅ OPTIONAL ATTACHMENT CHECK
                if (aAttachments.length > 0) {
                    if (aAttachments.length > 3) {
                        return MessageToast.show("You can upload maximum 3 images only.");
                    }

                    // fill payload only if files exist
                    aAttachments.forEach((file, index) => {
                        const i = index + 1;
                        if (i <= 3) {
                            photoPayload[`Photo${i}`] = file.content;
                            photoPayload[`Photo${i}Name`] = file.filename;
                            photoPayload[`Photo${i}Type`] = file.fileType;
                        }
                    });
                }

                const todayDate = new Date().toISOString().split("T")[0];

                const data = {
                    AppName: oBugModel.AppName,
                    BugDescription: oBugModel.BugDescription,
                    RaisedBy: oBugModel.RaisedBy,
                    CreatedDate: todayDate,
                    AssignedTo:oBugModel.EmployeeName,
                    Status: "Open",
                    AssignedToID: oBugModel.Email,
                    IssueType:oBugModel.IssueType,
                    RaisedID: this.getView().getModel("LoginModel").getProperty("/EmployeeID"),
                    ...photoPayload
                };

                const payload = { data };

                this.getBusyDialog();
                await this.ajaxCreateWithJQuery("RaiseBug", payload);
                this.closeBusyDialog();

                MessageToast.show("Bug submitted successfully");

                this.RB_onCancelButtonPress();
            },

            onFileSizeExceed: function (oEvent) {
                const sFileName = oEvent.getParameter("fileName");

                sap.m.MessageToast.show(`${sFileName} exceeds 2 MB size limit.`);
            },

            onSupportrequestChange: function (oEvent) {
                const oFiles = oEvent.getParameter("files");
                if (!oFiles || oFiles.length === 0) return;

                const oView = this.getView();
                const oRaiseBugModel = oView.getModel("RaiseBugModel");

                let aAttachments = oRaiseBugModel.getProperty("/attachments") || [];
                let aTokens = oRaiseBugModel.getProperty("/tokens") || [];

                if (aAttachments.length + oFiles.length > 3) return sap.m.MessageToast.show("You can upload maximum 3 files only");

                Array.from(oFiles).forEach((oFile) => {
                    // Check duplicate file name
                    const bDuplicate = aAttachments.some(file => file.filename === oFile.name);
                    if (bDuplicate) return MessageToast.show("This file is more than 2 MB and cannot be uploaded");

                    // File type validation
                    if (!oFile.type.match(/^image\/(jpeg|jpg|png)$/)) return MessageToast.show("Only JPG, JPEG, PNG allowed");

                    const oReader = new FileReader();

                    oReader.onload = (e) => {
                        const sBase64 = e.target.result.split(",")[1];
                        aAttachments.push({
                            filename: oFile.name,
                            fileType: oFile.type,
                            content: sBase64
                        });
                        aTokens.push({
                            key: oFile.name,
                            text: oFile.name
                        });
                        oRaiseBugModel.setProperty("/attachments", aAttachments);
                        oRaiseBugModel.setProperty("/tokens", aTokens);
                    };
                    oReader.readAsDataURL(oFile);
                });
                oEvent.getSource().clear();
            },
            onTokenDelete: function (oEvent) {

                const aDeletedTokens = oEvent.getParameter("tokens");

                if (!aDeletedTokens || aDeletedTokens.length === 0) return;

                const oView = this.getView();
                const oRaiseBugModel = oView.getModel("RaiseBugModel");

                let aAttachments = oRaiseBugModel.getProperty("/attachments") || [];
                let aTokens = oRaiseBugModel.getProperty("/tokens") || [];

                aDeletedTokens.forEach((oToken) => {
                    const sKey = oToken.getKey();
                    aAttachments = aAttachments.filter(file => file.filename !== sKey);
                    aTokens = aTokens.filter(token => token.key !== sKey);

                });
                oRaiseBugModel.setProperty("/attachments", aAttachments);
                oRaiseBugModel.setProperty("/tokens", aTokens);
            }


        });
    });