sap.ui.define(
    ["./BaseController", "../model/formatter",
        "sap/ui/export/Spreadsheet"],
    function (BaseController, Formatter, Spreadsheet) {
        "use strict";
        return BaseController.extend(
            "sap.kt.com.minihrsolution.controller.AdminPaySlip", {
            Formatter: Formatter,
            onInit: function () {
                this.getRouter().getRoute("RouteAdminPaySlip").attachMatched(this._onRouteMatched, this);
            },

            _onRouteMatched: async function (oEvent) {
                if (!this.that) this.that = this.getOwnerComponent().getModel("ThisModel")?.getData().that;
                var LoginFunction = await this.commonLoginFunction("PaySlip");
                if (!LoginFunction) return;
                this._isClearPressed = false;
                  if(oEvent.getParameter("arguments").from!=="AdminPayslipdetails"){
                     this.onClearAndSearch("AP_id_AdminPaySlip");// Clear and search function
                const currentYear = new Date().getFullYear();
                let fyStart, fyEnd;
                if (new Date().getMonth() >= 3) {
                    fyStart = new Date(currentYear, 3, 1); // April 1
                    fyEnd = new Date(currentYear + 1, 2, 31); // March 31 next year
                } else {
                    fyStart = new Date(currentYear - 1, 3, 1); // April 1 last year
                    fyEnd = new Date(currentYear, 2, 31); // March 31 this year
                }
                
                // Set the date range UI 
                this.oModel = this.getView().getModel("PaySlip");
                const oFilterState = this.oModel.getProperty("/PaySlipFilterState");
                const dateRangeControl = this.byId("AP_id_Date");
                if (oFilterState?.fromDetail) {
                    dateRangeControl.setDateValue(oFilterState.startDate);
                    dateRangeControl.setSecondDateValue(oFilterState.endDate);
                    this.oModel.setProperty("/PaySlipFilterState/fromDetail", false);
                } else {
                    dateRangeControl.setDateValue(fyStart);
                    dateRangeControl.setSecondDateValue(fyEnd);
                }
            }
                this.AP_onSearch();
                this.i18nModel = this.getView().getModel("i18n").getResourceBundle();
                this.oModel.setProperty("/isRouteLOP", false);
                this.getView().getModel("LoginModel").setProperty("/HeaderName", this.i18nModel.getText("paySlipTitle"));
                this.that.closeBusyDialog();
                this.initializeBirthdayCarousel();
            },

            AP_onPressAddPayslip: function () {
                this.getRouter().navTo("RouteNavAdminPaySlipApp");
            },

            onPressback: function () {
                this.getOwnerComponent().getRouter().navTo("RouteTilePage");
            },

            onLogout: function () {
                this.getOwnerComponent().getRouter().navTo("RouteLoginPage");
            },

            AP_onSearch: async function () {
                try {
                    this.getBusyDialog();
                    const aFilterItems = this.byId("AP_id_AdminPaySlip").getFilterGroupItems();
                    const params = {};
                    let paySlipDateProvided = false;

                    // Extract filter values
                    aFilterItems.forEach((oItem) => {
                        const oControl = oItem.getControl();
                        const sKey = oItem.getName();

                        if (oControl && typeof oControl.getValue === "function") {
                            const value = oControl.getValue().trim();

                            if (sKey === "PaySlipDate" && value.includes("to")) {
                                const aDates = value.split("to").map((str) => str.trim()); // Format: MM-yyyy to MM-yyyy
                                const [startMonth, startYear] = aDates[0].split("-");
                                const [endMonth, endYear] = aDates[1].split("-");

                                params.PaySlipStartMonth = `${startYear}-${startMonth}-01`; // yyyy-MM-01
                                params.PaySlipEndMonth = `${endYear}-${endMonth}-02`; // yyyy-MM-02
                                paySlipDateProvided = true;
                            } else if (typeof oControl.getSelectedKey === "function") {
                                if (oControl.getValue && oControl.getValue().trim() !== "") {
                                    params[sKey] = oControl.getValue();
                                } else {
                                    params[sKey] = oControl.getSelectedKey();
                                }
                            }
                        }
                    });

                    params.EmployeeID=this.byId("AP_id_Employee").getSelectedKey()
                    params.companyCode=this.byId("AP_id_CompanyCodeComboBox").getSelectedKey()

                    // Call backend
                    await this._commonGETCall("AdminPaySlip", "EmpTable", params);
                    this.closeBusyDialog();
                } catch (error) {
                    this.closeBusyDialog();
                    sap.m.MessageToast.show(this.i18nModel.getText("technicalError"));
                }
            },

            AP_onClear: function () {
                const aFilterItems =
                    this.byId("AP_id_AdminPaySlip").getFilterGroupItems();
                aFilterItems.forEach((oItem) => {
                    const oControl = oItem.getControl();
                    if (typeof oControl.setValue === "function") {
                        oControl.setValue("");
                    }
                    if (typeof oControl.setSelectedKey === "function") {
                        oControl.setSelectedKey("");
                    }
                });
                this._isClearPressed = true;
            },

            AP_onPressAddPayslip: function () {
                this.that.getBusyDialog();
                this.oModel.setProperty("/isCreate", true);
                this.oModel.setProperty("/isIdSelected", false);
                this.oModel.setProperty("/EmpData", {});
                this.oModel.setProperty("/BackRoute", "RouteAdminPaySlip");
                this.getRouter().navTo("RouteNavAdminPaySlipApp");
            },

            AP_onPressPayslip: function (oEvent) {
                const oDate = this.byId("AP_id_Date");

                this.oModel.setProperty("/PaySlipFilterState", {
                    startDate: oDate.getDateValue(),
                    endDate: oDate.getSecondDateValue(),
                    fromDetail: true
                });
                this.that.getBusyDialog();
                var sPath = oEvent.getSource().getBindingContext("PaySlip").getPath();
                this.oModel.setProperty("/isCreate", false);
                this.oModel.setProperty("/isIdSelected", true);
                this.oModel.setProperty("/EmpData", {});
                this.oModel.setProperty("/BackRoute", "RouteAdminPaySlip");
                var month = this.oModel.getProperty(`${sPath}/YearMonth`).split("-")[1];
                var filters = {
                    ID: this.oModel.getProperty(`${sPath}/ID`),
                    EmployeeID: this.oModel.getProperty(`${sPath}/EmployeeID`),
                    FinancialYear: this.oModel.getProperty(`${sPath}/FinancialYear`),
                    Month: month,
                };
                this.oModel.setProperty("/SelectedFilters", filters);
                this.getRouter().navTo("RouteNavAdminPaySlipApp");
            },

            AP_TableDataDownload: function () {
                var table = this.byId("AP_id_AdminPaySlipTable");
                const oModelData = table.getModel("PaySlip").getData().EmpTable;
                const aFormattedData = oModelData.map(item => {
                    return {
                        ...item,
                        YearMonth: Formatter.formatMonthYear(item.YearMonth),
                        DeductionsTotalMonthly: Formatter.CurrencyInINRText(item.DeductionsTotalMonthly),
                        EarningsTotalMonthly: Formatter.CurrencyInINRText(item.EarningsTotalMonthly),
                        NetPay: Formatter.CurrencyInINRText(item.NetPay),
                    };
                });
                const aCols = [
                    { label: this.i18nModel.getText("employeeID"), property: "EmployeeID", type: "string" },
                    { label: this.i18nModel.getText("employeeName"), property: "EmployeeName", type: "string" },
                    { label: this.i18nModel.getText("monthAndYear"), property: "YearMonth", type: "string" },
                    { label: this.i18nModel.getText("payableDays"), property: "PayableDays", type: "string" },
                    { label: this.i18nModel.getText("totalEarningAmount"), property: "EarningsTotalMonthly", type: "string" },
                    { label: this.i18nModel.getText("totalDeductionAmount"), property: "DeductionsTotalMonthly", type: "string " },
                    { label: this.i18nModel.getText("netPay"), property: "NetPay", type: "string" },
                ];
                const oSettings = {
                    workbook: {
                        columns: aCols,
                        context: {
                            sheetName: this.i18nModel.getText("payslipDetails")
                        }
                    },
                    dataSource: aFormattedData,
                    fileName: "Payslip_Details.xlsx"
                };
                const oSheet = new Spreadsheet(oSettings);
                oSheet.build().then(function () {
                    sap.m.MessageToast.show(this.i18nModel.getText("downloadsuccessfully"));
                }.bind(this)).finally(function () {
                    oSheet.destroy();
                });
            }
        },
        );
    }
);