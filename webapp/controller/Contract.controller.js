sap.ui.define(
    [
        "./BaseController", // Import BaseController
        "../model/formatter", // Custom formatter functions
        "sap/ui/model/json/JSONModel", //json model
        "../utils/validation", // Import validation functions
        "sap/m/MessageToast", // Import MessageToast for displaying messages
        "sap/suite/ui/commons/Timeline", // Import Timeline for displaying comments
        "sap/suite/ui/commons/TimelineItem", //Import TimelineItem for individual comments
        "sap/ui/export/Spreadsheet"
    ],
    function (BaseController, Formatter, JSONModel, utils, MessageToast, Timeline, TimelineItem, Spreadsheet) {
        "use strict";
        return BaseController.extend(
            "sap.kt.com.minihrsolution.controller.Contract", {
            Formatter: Formatter,
            onInit: function () {
                this.getRouter().getRoute("RouteContract").attachMatched(this._onRouteMatched, this);
            },

            _onRouteMatched: async function (oEvent) {
                const LoginFunction = await this.commonLoginFunction("Contract");
                if (!LoginFunction) return;

                this.getBusyDialog();

                this.i18nModel = this.getView().getModel("i18n").getResourceBundle();

                // Button states
                this.byId("C_id_ActivateBtn").setEnabled(false);
                this.byId("Con_id_ResendEmail").setEnabled(false);
                this.byId("C_id_Renewbtn").setEnabled(false);
                this.byId("C_id_Salary").removeSelections(true);

                // Header
                this.getView().getModel("LoginModel").setProperty(
                    "/HeaderName",
                    this.i18nModel.getText("contractDetails")
                );

                const from = oEvent.getParameter("arguments")?.from;

                try {
                    this._isClearPressed = false;

                    // Apply default only if NOT coming from details/edit screen
                    if (from !== "ContractDetails") {

                        this.onClearAndSearch("C_id_FilterBar");

                        // Financial Year Logic
                        const today = new Date();
                        const currentYear = today.getFullYear();

                        let fyStart, fyEnd;

                        if (today.getMonth() >= 3) {
                            fyStart = new Date(currentYear, 3, 1); // April 1
                            fyEnd = new Date(currentYear + 1, 2, 31); // March 31 next year
                        } else {
                            fyStart = new Date(currentYear - 1, 3, 1); // April 1 last year
                            fyEnd = new Date(currentYear, 2, 31); // March 31 this year
                        }

                        const oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
                            pattern: "yyyy-MM-dd",
                        });

                        const params = {
                            AssignmentStartDate: oDateFormat.format(fyStart),
                            AssignmentEndDate: oDateFormat.format(fyEnd),
                        };

                        // Set UI Date Range
                        const oDateRange = this.byId("C_id_Year");
                        if (oDateRange) {
                            oDateRange.setDateValue(fyStart);
                            oDateRange.setSecondDateValue(fyEnd);
                        }

                        // Initial fetch
                        await this._fetchCommonData("Contract", "ContractModelInitial", params);

                        const oInitialModel = this.getView().getModel("ContractModelInitial");
                        const aInitialData = oInitialModel.getData();

                        // Deduplicate EndClient
                        const uniqueEndClients = [];
                        const seen = new Set();

                        aInitialData.forEach(item => {
                            if (item.EndClient && !seen.has(item.EndClient)) {
                                seen.add(item.EndClient);
                                uniqueEndClients.push({
                                    EndClient: item.EndClient
                                });
                            }
                        });

                        const oEndClientModel = new sap.ui.model.json.JSONModel(uniqueEndClients);
                        this.getView().setModel(oEndClientModel, "EndClientModel");

                        // Final fetch
                        await this._fetchCommonData("Contract", "ContractModel", params);

                    } else {
                        // Preserve filters (edit/navigation case)
                        await this.C_onSearch();
                    }

                    this.initializeBirthdayCarousel();

                } catch (error) {
                    sap.m.MessageToast.show(error.message || error.responseText);
                } finally {
                    this.closeBusyDialog();
                }
            },

            C_onSearch: async function () {
                try {
                    this.getBusyDialog();
                    const aFilterItems = this.byId("C_id_FilterBar").getFilterGroupItems();
                    var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
                        pattern: "yyyy-MM-dd"
                    });
                    const params = {};
                    let dateProvided = false;

                    aFilterItems.forEach((oItem) => {
                        const oControl = oItem.getControl();
                        const sKey = oItem.getName();

                        if (!oControl) return;

                        // Date range
                        if (sKey === "Year" && oControl instanceof sap.m.DateRangeSelection) {
                            const oStartDate = oControl.getDateValue();
                            const oEndDate = oControl.getSecondDateValue();
                            if (oStartDate && oEndDate) {
                                params.AssignmentStartDate = oDateFormat.format(oStartDate);
                                params.AssignmentEndDate = oDateFormat.format(oEndDate);
                                dateProvided = true;
                            }
                            return;
                        }

                        // Select
                        if (oControl instanceof sap.m.Select) {
                            const sSelectedKey = oControl.getSelectedKey();
                            if (sSelectedKey) params[sKey] = sSelectedKey;
                            return;
                        }

                        // ComboBox
                        if (oControl instanceof sap.m.ComboBox) {
                            const sSelectedKey = oControl.getValue();
                            const sValue = oControl.getValue().trim();
                            if (sSelectedKey) params[sKey] = sSelectedKey;
                            else if (sValue) params[sKey] = sValue;
                            return;
                        }

                        // Generic input
                        if (typeof oControl.getValue === "function") {
                            const sValue = oControl.getValue().trim();
                            if (sValue) params[sKey] = sValue;
                        }
                    });

                    // Financial Year Logic
                    const today = new Date();
                    const currentYear = today.getFullYear();
                    let fyStart, fyEnd, financialYearLabel;

                    if (today.getMonth() >= 3) {
                        fyStart = new Date(currentYear, 3, 1); // April 1
                        fyEnd = new Date(currentYear + 1, 2, 31); // March 31 next year
                        financialYearLabel = `${currentYear}-${currentYear + 1}`;
                    } else {
                        fyStart = new Date(currentYear - 1, 3, 1); // April 1 last year
                        fyEnd = new Date(currentYear, 2, 31); // March 31 this year
                        financialYearLabel = `${currentYear - 1}-${currentYear}`;
                    }

                    if (this._isClearPressed) { // User clicked Clear
                        delete params.AssignmentStartDate;
                        delete params.AssignmentEndDate;
                        delete params.FinancialYear;
                        this._isClearPressed = false;
                    } else {
                        // User-selected date → check if matches FY range
                        const startDate = new Date(params.AssignmentStartDate);
                        const endDate = new Date(params.AssignmentEndDate);
                        if (startDate.getTime() === fyStart.getTime() && endDate.getTime() === fyEnd.getTime()) {
                            params.FinancialYear = financialYearLabel;
                        }
                    }

                    // Fetch data
                    await this._fetchCommonData("Contract", "ContractModelInitial", {
                        AssignmentStartDate: params.AssignmentStartDate,
                        AssignmentEndDate: params.AssignmentEndDate,
                    });

                    // Deduplicate EndClient values
                    const oModel = this.getView().getModel("ContractModelInitial");
                    const aData = oModel.getData();
                    const uniqueEndClients = [];
                    const seen = new Set();
                    aData.forEach(item => {
                        if (item.EndClient && !seen.has(item.EndClient)) {
                            seen.add(item.EndClient);
                            uniqueEndClients.push({
                                EndClient: item.EndClient
                            });
                        }
                    });
                    const oEndClientModel = new sap.ui.model.json.JSONModel(uniqueEndClients);
                    this.getView().setModel(oEndClientModel, "EndClientModel");

                    await this._fetchCommonData("Contract", "ContractModel", params);
                    this.closeBusyDialog();
                } catch (error) {
                    this.closeBusyDialog();
                    sap.m.MessageToast.show(error.message || error.responseText || "Error during search");
                }
            },

            _getFinancialYearDates: function () {
                var today = new Date();
                var currentYear = today.getFullYear();

                var fyStart = new Date(currentYear, 0, 1); // January 1st
                var fyEnd = new Date(currentYear, 11, 31); // December 31st

                return {
                    start: fyStart,
                    end: fyEnd
                };
            },

            C_onClearFilters: function () {
                const oFilterBar = this.byId("C_id_FilterBar");
                oFilterBar.getFilterGroupItems().forEach((item) => {
                    const oControl = item.getControl();
                    if (oControl instanceof sap.m.ComboBox || oControl instanceof sap.m.Select) {
                        oControl.setSelectedKey("");
                    } else if (oControl instanceof sap.m.Input) {
                        oControl.setValue("");
                    } else if (oControl instanceof sap.m.DateRangeSelection) {
                        oControl.setDateValue(null);
                        oControl.setSecondDateValue(null);
                    }
                });
                this._isClearPressed = true;
            },

            onPressback: function () {
                this.getRouter().navTo("RouteTilePage");
            },

            onLogout: function () {
                this.CommonLogoutFunction(); // Navigate to login page
            },

            C_onPressAddContract: function (oEvent) {
                var oParValue, sAgreementNo = "";
                var isCreateMode = oEvent.getSource().getId().lastIndexOf("C_id_AddBtn") !== -1;
                if (isCreateMode) { // Case: Add new contract
                    oParValue = "CreateContractFlag";
                    // Navigate only with sParContract (no AgreementNo during create)
                    this.getRouter().navTo("RouteContractDetails", {
                        sParContract: oParValue,
                        sID: sAgreementNo || null
                    });
                } else {
                    // Case: Edit existing contract
                    var oContext = oEvent.getSource().getBindingContext("ContractModel");
                    var oData = oContext.getModel().getData()[oContext.getPath().split("/")[1]];
                    oParValue = oData.ContractNo;
                    sAgreementNo = oData.AgreementNo;
                    // Navigate with both ContractNo and AgreementNo
                    this.getRouter().navTo("RouteContractDetails", {
                        sParContract: oParValue,
                        sID: sAgreementNo
                    });
                }
            },

            CD_ValidateComboBox: function (oEvent) {
                utils._LCstrictValidationComboBox(oEvent);
            },


            CD_validateMobileNo: function (oEvent) {
                var sStdCode = sap.ui.getCore().byId("CR_id_codeModel").getValue()
                utils._LCvalidateMobileNumberWithSTD(oEvent, sStdCode);
            },

            CD_validateAmount: function (oEvent) {
                utils._LCvalidateAmount(oEvent);
            },

            CD_validateDate: function (oEvent) {
                utils._LCvalidateDate(oEvent)
            },

            // Format date string to Date object
            onFormatDate: function (dateString) {
                var parts = dateString.split('/');
                return new Date(parts[2], parts[1] - 1, parts[0]);
            },

            CU_onChangeAggrementDate: function () {
                var oModelData = this.byId("C_id_Salary").getSelectedItem().getBindingContext("ContractModel").getObject();
                this.AssignmentStartDate = this.Formatter.formatDate(oModelData.AssignmentStartDate);
                const supdateAgreementDate = this.onFormatDate(this.AssignmentStartDate);
                if (supdateAgreementDate) {
                    sap.ui.getCore().byId("CR_id_AssignmentStartDate")?.setMinDate(supdateAgreementDate);
                    sap.ui.getCore().byId("CR_id_AssignmentEndDate")?.setMinDate(supdateAgreementDate);
                }
            },

            formatDateToISO: function (dateObj) {
                if (!dateObj || !(dateObj instanceof Date)) return "";
                const year = dateObj.getFullYear();
                const month = (dateObj.getMonth() + 1).toString().padStart(2, "0");
                const day = dateObj.getDate().toString().padStart(2, "0");
                return `${year}-${month}-${day}`; // YYYY-MM-DD
            },

            onShowMore: function (oEvent) {
                var oContext = oEvent.getSource().getBindingContext("ContractModel");
                var oData = oContext.getObject();
                var oComment = oData.Comments || {};

                var oTimelineItem = new sap.suite.ui.commons.TimelineItem({
                    dateTime: this.Formatter.formatDate(oData.AssignmentStartDate),
                    text: oComment || "No comment provided",
                    userNameClickable: false,
                    icon: "sap-icon://comment"
                });

                var oTimeline = new sap.suite.ui.commons.Timeline({
                    showHeader: false,
                    enableBusyIndicator: false,
                    width: "100%",
                    sortOldestFirst: true,
                    enableDoubleSided: false,
                    content: [oTimelineItem],
                    showHeaderBar: false
                });

                var oDialog = new sap.m.Dialog({
                    title: this.getView().getModel("i18n").getProperty("comments"),
                    contentWidth: "15rem",
                    contentHeight: "5rem",
                    draggable: true,
                    resizable: true,
                    content: [oTimeline],
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
            },

            onSelectionChange: function (oEvent) {
                var oSelectedItem = oEvent.getParameter("listItem");
                var oActivateBtn = this.byId("C_id_ActivateBtn");
                var oRenewBtn = this.byId("C_id_Renewbtn");

                // Always disable both first
                oActivateBtn.setEnabled(false);
                oRenewBtn.setEnabled(false);

                if (!oSelectedItem) return;

                var oContext = oSelectedItem.getBindingContext("ContractModel");
                var oData = oContext.getObject();
                var sStatus = oData.ContractStatus;
                this.byId("Con_id_ResendEmail").setEnabled(sStatus === "Active");
                var sEndDate = oData.AssignmentEndDate;

                if (sStatus === "New") {
                    oActivateBtn.setEnabled(true);
                }

                if ((sStatus === "Active") && sEndDate) {
                    var endDate = this.Formatter.formatDate(sEndDate); // 'dd/mm/yyyy'
                    var endArr = endDate.split('/').map(Number);
                    var endDateObj = new Date(endArr[2], endArr[1] - 1, endArr[0]);
                    var today = new Date();

                    if (today >= endDateObj) {
                        oRenewBtn.setEnabled(true);
                    }
                }

                if (sStatus === "Inactive") {
                    oRenewBtn.setEnabled(true);
                }
            },

            C_id_ActivatePress: function () {
                var oView = this.getView();
                // Set visibility flags
                var oVisibleModel = new JSONModel({
                    showContractFields: true,
                    showMobileFields: true,
                    showComments: true,
                    showDateFields: false,
                    showAmountCurrencyFields: false
                });
                this.getView().setModel(oVisibleModel, "ContractFormVisibleModel");
                var oTable = this.byId("C_id_Salary").getSelectedItem();
                var oModelData = oTable.getBindingContext("ContractModel").getObject();
                var ContractActivejson = {
                    ContractNo: oModelData.ContractNo,
                    AgreementNo: oModelData.AgreementNo,
                    STDCode: oModelData.STDCode,
                    MobileNo: oModelData.MobileNo,
                    Comments: "",
                    ContractStatus: "New"
                };
                oView.setModel(new JSONModel(ContractActivejson), "ContractActiveModel");
                this.openContractDialog(oView);
            },

            C_id_RenewPress: function () {
                var oView = this.getView();
                // Set visibility flags
                var oVisibleModel = new JSONModel({
                    showContractFields: true,
                    showMobileFields: false,
                    showComments: true,
                    showDateFields: true,
                    showAmountCurrencyFields: true
                });
                this.getView().setModel(oVisibleModel, "ContractFormVisibleModel");
                var oTable = this.byId("C_id_Salary").getSelectedItem();
                var oModelData = oTable.getBindingContext("ContractModel").getObject();
                var rateType = oModelData.ConsultantRate.split(" ")[3];
                var varible = rateType === "Hour" ? 0 : rateType === "Day" ? 1 : 2;

                var ContractActivejson = {
                    ContractNo: oModelData.ContractNo,
                    AgreementNo: oModelData.AgreementNo,
                    HrDaliyMonth: varible,
                    AssignmentStartDate: "",
                    AssignmentEndDate: "",
                    Amount: Number((oModelData.ConsultantRate.split(" ")[0]).replace(/,/g, '')),
                    Currency: oModelData.ConsultantRate.split(" ")[1],
                    Comments: "",
                    ContractPeriod: oModelData.ContractPeriod,
                    ContractStatus: "Renewed"
                };
                oView.setModel(new JSONModel(ContractActivejson), "ContractActiveModel");
                this.openContractDialog(oView);
            },

            openContractDialog: function (oView) {
                if (!this.oContractDialog) {
                    // Load dialog fragment if not already loaded
                    sap.ui.core.Fragment.load({
                        name: "sap.kt.com.minihrsolution.fragment.ContractRenew",
                        controller: this,
                    }).then(function (oContractDialog) {
                        this.oContractDialog = oContractDialog;
                        oView.addDependent(this.oContractDialog);
                        this.CU_onChangeAggrementDate();
                        this.oContractDialog.open();
                        this.oContractDialog.open();
                        this.oContractDialog.attachAfterOpen(function () {
                            document.activeElement.blur();
                        });
                    }.bind(this));
                } else {
                    this._resetDialogFields(); // Reset fields to original data
                    this.CU_onChangeAggrementDate();
                    this.oContractDialog.open();
                    this.oContractDialog.attachAfterOpen(function () {
                        document.activeElement.blur();
                    });
                }
            },

            _resetDialogFields: function () {
                sap.ui.getCore().byId("CR_id_AssignmentStartDate").setValueState("None")
                sap.ui.getCore().byId("CR_id_AssignmentEndDate").setValueState("None")
                sap.ui.getCore().byId("CR_id_EditAmountInput").setValueState("None")
                sap.ui.getCore().byId("CR_id_Mobile").setValueState("None")
                sap.ui.getCore().byId("CR_id_codeModel").setValueState("None")
            },

            CR_onPressClose: function () {
                this.oContractDialog.close();
                this.byId("C_id_ActivateBtn").setEnabled(false);
                this.byId("C_id_Renewbtn").setEnabled(false);
                this.byId("C_id_Salary").removeSelections(true);
            },

            CR_onPressSubmit: async function () {
                var oView = this.getView();
                var oContractFormVisible = oView.getModel("ContractFormVisibleModel").getData();
                var oModel = oView.getModel("ContractActiveModel").getData();
                if (oModel.ContractStatus === "Renewed") {
                    // Validate required fields for Renewed status
                    const isMandatoryValid = (
                        utils._LCvalidateDate(sap.ui.getCore().byId("CR_id_AssignmentStartDate"), "ID") &&
                        utils._LCvalidateAmount(sap.ui.getCore().byId("CR_id_EditAmountInput"), "ID")
                    );

                    if (!isMandatoryValid) {
                        this.closeBusyDialog();
                        MessageToast.show(this.i18nModel.getText("mandetoryFields"));
                        return;
                    }

                    const rateType = oModel.HrDaliyMonth;
                    const rateText = rateType === 0 ? "Hour" : rateType === 1 ? "Day" : "Month";
                    const selectedCurrency = sap.ui.getCore().byId("CR_id_CurrencySelect").getSelectedKey();
                    const ConsultantRate = `${Formatter.fromatNumber(oModel.Amount)} ${selectedCurrency} Per ${rateText} Including all tax`;
                    const startDate = sap.ui.getCore().byId("CR_id_AssignmentStartDate").getDateValue();
                    const endDate = sap.ui.getCore().byId("CR_id_AssignmentEndDate").getDateValue();

                    try {
                        let jsonData = {
                            ContractNo: oModel.ContractNo,
                            AgreementNo: oModel.AgreementNo,
                            StartDate: this.formatDateToISO(startDate),
                            EndDate: this.formatDateToISO(endDate),
                            ContractPeriod: oModel.ContractPeriod,
                            ConsultantRate: ConsultantRate,
                            Comments: oModel.Comments,
                        };

                        this.getBusyDialog();
                        var updateContract = await this.ajaxCreateWithJQuery("ContractStatusUpdate", jsonData);
                        if (updateContract.success) {
                            MessageToast.show(this.i18nModel.getText("agreementRenewSuccess"));
                            this.oContractDialog.close();
                            this.byId("C_id_ActivateBtn").setEnabled(false);
                            this.byId("C_id_Renewbtn").setEnabled(false);
                            this.byId("C_id_Salary").removeSelections(true);
                            return this.C_onSearch();
                        }
                    } catch (error) {
                        this.oContractDialog.close();
                        sap.m.MessageBox.error(this.i18nModel.getText("createNewContractFailed"));
                        this.closeBusyDialog();
                        return;
                    }
                }

                // Activation flow
                if (oModel.ContractStatus === "New") {
                    if (oContractFormVisible.showMobileFields) {
                        const isValid = (
                            utils._LCstrictValidationComboBox(sap.ui.getCore().byId("CR_id_codeModel"), "ID") &&
                            utils._LCvalidateMobileNumberWithSTD(sap.ui.getCore().byId("CR_id_Mobile"), oModel.STDCode)
                        );

                        if (!isValid) {
                            this.closeBusyDialog();
                            MessageToast.show(this.i18nModel.getText("mandetoryFields"));
                            return;
                        }
                    }

                    var oModelData = this.byId("C_id_Salary").getSelectedItem().getBindingContext("ContractModel").getObject();

                    try {
                        var jsonData = {
                            ContractNo: oModel.ContractNo,
                            AgreementNo: oModel.AgreementNo,
                            Comments: oModel.Comments,
                            ContractStatus: "Active",
                            ConsultantNameSalutation: oModelData.ConsultantNameSalutation,
                            ConsultantName: oModelData.ConsultantName,
                            ConsultingService: oModelData.ConsultingService,
                            ConsultantAddress: oModelData.ConsultantAddress,
                            EndClient: oModelData.EndClient,
                            LocationService: oModelData.LocationService,
                            AssignmentStartDate: oModelData.AssignmentStartDate,
                            AssignmentEndDate: oModelData.AssignmentEndDate,
                            ConsultantRate: oModelData.ConsultantRate,
                            PaymentTerms: oModelData.PaymentTerms,
                            ClientReportContactSalutation: oModelData.ClientReportContactSalutation,
                            ClientReportContact: oModelData.ClientReportContact,
                            SpecificInsuranceRequirement: oModelData.SpecificInsuranceRequirement,
                            ContractPeriod: oModelData.ContractPeriod,
                            ExpensesClaim: oModelData.ExpensesClaim,
                            AgreementDate: oModelData.AgreementDate,
                            ContarctEmail: oModelData.ContarctEmail,
                            ContractLocation: oModelData.ContractLocation,
                            BranchCode: oModelData.BranchCode,
                            CompanyCode: oModelData.CompanyCode,
                            Branch: oModelData.Branch,
                            Country: oModelData.Country,
                            State: oModelData.State
                        };

                        if (oContractFormVisible.showMobileFields) {
                            jsonData.MobileNo = oModel.MobileNo;
                            jsonData.STDCode = oModel.STDCode;
                        }

                        const requestData = {
                            filters: {
                                ContractNo: oModel.ContractNo,
                                AgreementNo: oModel.AgreementNo
                            },
                            data: jsonData
                        };

                        this.getBusyDialog();
                        var updateResponse = await this.ajaxUpdateWithJQuery("Contract", requestData);
                        if (updateResponse.success) {
                            MessageToast.show(this.i18nModel.getText("agreementActiveSuccess"));
                            this.oContractDialog.close();
                            this.byId("C_id_ActivateBtn").setEnabled(false);
                            this.byId("C_id_Renewbtn").setEnabled(false);
                            this.byId("C_id_Salary").removeSelections(true);
                            return this.C_onSearch();
                        }
                    } catch (error) {
                        this.oContractDialog.close();
                        this.closeBusyDialog();
                        MessageToast.show(this.i18nModel.getText("updateContractFailed"));
                    }
                }
                this.closeBusyDialog();
            },

            getGroupHeader: function (oGroup) {
                return this.getStyledGroupHeader(oGroup);
            },

            C_DownloadTableData: function () {
                var table = this.byId("C_id_Salary");
                const oModelData = table.getModel("ContractModel").getData();
                const aFormattedData = oModelData.map(item => {
                    return {
                        ...item,
                        AssignmentStartDate: Formatter.formatDate(item.AssignmentStartDate),
                        AssignmentEndDate: Formatter.formatDate(item.AssignmentEndDate),
                    };
                });
                const aCols = [
                    { label: this.i18nModel.getText("aggrementNo"), property: "AgreementNo", type: "string" },
                    { label: this.i18nModel.getText("contractNo "), property: "ContractNo", type: "string" },
                    { label: this.i18nModel.getText("consultantName"), property: "ConsultantName", type: "string" },
                    { label: this.i18nModel.getText("email"), property: "ContarctEmail", type: "string" },
                    { label: this.i18nModel.getText("locationswhereServices"), property: "LocationService", type: "string" },
                    { label: this.i18nModel.getText("contractLocation"), property: "ContractLocation", type: "string" },
                    { label: this.i18nModel.getText("endClient"), property: "EndClient", type: "string" },
                    { label: this.i18nModel.getText("startDate"), property: "AssignmentStartDate", type: "string" },
                    { label: this.i18nModel.getText("endDate"), property: "AssignmentEndDate", type: "string" },
                    { label: this.i18nModel.getText("amount"), property: "ConsultantRate", type: "string " },
                    { label: this.i18nModel.getText("paymentterms"), property: "PaymentTerms", type: "string " },
                ];
                const oSettings = {
                    workbook: {
                        columns: aCols,
                        context: { sheetName: this.i18nModel.getText("contractDetails") }
                    },
                    dataSource: aFormattedData,
                    fileName: "Contract_Details.xlsx"
                };
                const oSheet = new Spreadsheet(oSettings);
                oSheet.build().then(function () {
                    MessageToast.show(this.i18nModel.getText("downloadsuccessfully"));
                }.bind(this)).finally(function () {
                    oSheet.destroy();
                });
            },

            Con_onResendOnboardingEmail: function () {
                var that = this;
                var oTable = this.byId("C_id_Salary");
                var oSelectedItem = oTable.getSelectedItem();

                if (!oSelectedItem) return MessageToast.show("Please select one record.");

                var oData = oSelectedItem.getBindingContext("ContractModel").getObject();

                this.getBusyDialog();

                this.ajaxCreateWithJQuery("ContractOnboardEmail", {
                    "EmployeeID": oData.ContractNo ,
                    "UserName": oData.ConsultantName,
                    "toEmailID": [oData.ContarctEmail],
                    "flag": "X"
                })
                    .then((response) => {
                        this.closeBusyDialog();
                        MessageToast.show("Onboarding email sent successfully.");
                        that.byId("Con_id_ResendEmail").setEnabled(false);
                        that.byId("C_id_Salary").removeSelections(true);
                        that.byId("C_id_Renewbtn").setEnabled(false);
                    })
                    .catch((error) => {
                        this.closeBusyDialog();
                        MessageToast.show(error.message || error.responseText || "Error while sending email.");
                    });
            }

        });
    });