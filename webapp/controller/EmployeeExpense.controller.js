sap.ui.define(["./BaseController", "sap/m/MessageToast", "sap/ui/model/json/JSONModel", "sap/ui/model/Filter", "sap/ui/model/FilterOperator", "sap/kt/com/minihrsolution/model/formatter"], function(BaseController, MessageToast, JSONModel, Filter, FilterOperator, formatter, ) {
    "use strict";
    return BaseController.extend("sap.kt.com.minihrsolution.controller.EmployeeExpense", {
        formatter: formatter,
        cleanRecords: function(arr) {
            return (arr || []).filter(function(item) {
                return item && typeof item === "object" && item.ExpenseID && item.ExpenseID.trim() !== "" && item.TotalAmount !== null && item.TotalAmount !== undefined;
            });
        },
        onInit: function() {
            this.getRouter().getRoute("RouteEmployeeExpense").attachMatched(this._onRouteMatched, this);
        },
        _applyExpenseChartColors: function() {
            var oChart = this.byId("EE_id_ExpenseTypeChart");
            oChart.setVizProperties({
                plotArea: {
                    dataPointStyle: {
                        rules: [{
                            dataContext: {
                                "Expense Type": this.i18n.getText("companyExpense")
                            },
                            properties: {
                                color: "#f1760b"
                            },
                            displayName: this.i18n.getText("companyExpense")
                        }, {
                            dataContext: {
                                "Expense Type": this.i18n.getText("pendingExpense")
                            },
                            properties: {
                                color: "#BB0000"
                            },
                            displayName: this.i18n.getText("pendingExpense")
                        }, {
                            dataContext: {
                                "Expense Type": this.i18n.getText("reimbursementAmount")
                            },
                            properties: {
                                color: "#107E3E"
                            },
                            displayName: this.i18n.getText("reimbursementAmount")
                        }]
                    }
                }
            });
        },
        _applyTripTypeChartColors: function() {
            var oChart = this.byId("EE_id_TripTypeChart");
            oChart.setVizProperties({
                plotArea: {
                    colorPalette: ["#107E3E", "#0A6ED1"]
                }
            });
        },
        _onRouteMatched: async function() {
            try {
                const LoginFUnction = await this.commonLoginFunction("Expense");
                if (!LoginFUnction) {
                    return;
                }
                // i18n model
                this.i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle();
                // Default Financial Year
                this.byId("EE_id_ExpenseDate").setDateValue(new Date(new Date().getMonth() < 3 ? new Date().getFullYear() - 1 : new Date().getFullYear(), 3, 1));
                this.byId("EE_id_ExpenseDate").setSecondDateValue(new Date(new Date().getMonth() < 3 ? new Date().getFullYear() : new Date().getFullYear() + 1, 2, 31));
                this.EE_onGoPress();
            } catch (e) {
                console.error("Login Error:", e);
            }
        },
        EE_onGoPress: async function() {
            const oView = this.getView();
            const oDateRange = this.byId("EE_id_ExpenseDate");
            const oStartDate = oDateRange.getDateValue();
            const oEndDate = oDateRange.getSecondDateValue();
            // Validate first before opening Busy Dialog
            if (!oStartDate || !oEndDate) {
                MessageToast.show(this.i18n.getText("selectExpenseDateRange"));
                return;
            }
            try {
                this.getBusyDialog();
                const sStartDate = new Date(oStartDate.getTime() - (oStartDate.getTimezoneOffset() * 60000)).toISOString().split("T")[0];
                const sEndDate = new Date(oEndDate.getTime() - (oEndDate.getTimezoneOffset() * 60000)).toISOString().split("T")[0];
                const oPayload = {
                    startDate: sStartDate,
                    endDate: sEndDate,
                    EmployeeID: oView.getModel("LoginModel").getProperty("/EmployeeID")
                };
                const oResponse = await this.ajaxCreateWithJQuery("Employee_Expense_BarChart", oPayload);
                this._oFullExpenseData = oResponse;
                console.log("Expense Response:", oResponse);
                const oFirst4Card = oResponse?.First4Card || {};
                oView.setModel(new JSONModel(oResponse || {}), "EE_ExpenseBarChartModel");
                oView.setModel(new JSONModel({
                    totalExpense: oFirst4Card.TotalAmount || 0,
                    companyExpense: oFirst4Card.CompanyAmount || 0,
                    pendingExpense: oFirst4Card.PendingAmount || 0,
                    reimbursementAmount: oFirst4Card.ReimbursementAmount || 0
                }), "EE_ExpenseModel");
                const aExpenseTypeChart = [];
                const iCompany = oResponse?.PaymentBreakdown?.CompanyAmount || 0;
                const iPending = oResponse?.PaymentBreakdown?.PendingAmount || 0;
                const iReimbursement = oResponse?.PaymentBreakdown?.ReimbursementAmount || 0;
                if (iCompany > 0) {
                    aExpenseTypeChart.push({
                        ExpenseTypeKey: "COMPANY",
                        ExpenseType: this.i18n.getText("companyExpense"),
                        Amount: iCompany,
                        color: "#f1760b"
                    });
                }
                if (iPending > 0) {
                    aExpenseTypeChart.push({
                        ExpenseTypeKey: "PENDING",
                        ExpenseType: this.i18n.getText("pendingExpense"),
                        Amount: iPending,
                        color: "#BB0000"
                    });
                }
                if (iReimbursement > 0) {
                    aExpenseTypeChart.push({
                        ExpenseTypeKey: "REIMBURSEMENT",
                        ExpenseType: this.i18n.getText("reimbursementAmount"),
                        Amount: iReimbursement,
                        color: "#107E3E"
                    });
                }
                this.getView().setModel(new JSONModel({
                    typeChart: aExpenseTypeChart,
                    monthly: oResponse.MonthlyTrend || [],
                    tripType: oResponse.TripTypeData || [],
                    Top10Expenses: oResponse.Top10Expenses || [],
                    byExpenseType: oResponse.ByExpenseType || []
                }), "EE_ExpenseChartModel");
                this._applyCommonChartSettings("EE_id_ExpenseTypeChart");
                this._applyCommonChartSettings("EE_id_MonthlyChart");
                this._applyCommonChartSettings("EE_id_TripTypeChart");
                this._applyExpenseChartColors();
                this._applyTripTypeChartColors();
            } catch (oError) {
                console.error("Expense API Error:", oError);
            } finally {
                this.closeBusyDialog();
            }
        },
        _applyCommonChartSettings: function(sChartId) {
            var oChart = this.byId(sChartId);
            if (!oChart) {
                return;
            }
            oChart.setVizProperties({
                title: {
                    visible: false
                },
                legend: {
                    visible: true
                },
                interaction: {
                    selectability: {
                        mode: "SINGLE"
                    }
                },
                plotArea: {
                    dataLabel: {
                        visible: true,
                        type: "value"
                    }
                }
            });
        },
        onNavBack: function() {
            if (this._sSource === "RouteEmployeeExpense") {
                this.getRouter().navTo("RouteEmployeeExpense");
            } else {
                this.getRouter().navTo("RouteTilePage");
            }
        },
        EE_onClearPress: function() {
            this.byId("EE_id_ExpenseDate").setDateValue(null);
            this.byId("EE_id_ExpenseDate").setSecondDateValue(null);
        },
        _openExpenseDialog: async function(sTitle, aItems) {
            aItems = Array.isArray(aItems) ? aItems : [];
            var fGrandTotal = aItems.reduce(function(sum, item) {
                var value = parseFloat(
                    (item.TotalAmount || "0").toString().replace(/,/g, ""));
                return sum + (isNaN(value) ? 0 : value);
            }, 0);
            this.getView().setModel(new JSONModel({
                dialogTitle: sTitle,
                items: aItems,
                GrandTotal: fGrandTotal
            }), "detailModel");
            if (!this._oExpenseDialog) {
                this._oExpenseDialog = await sap.ui.core.Fragment.load({
                    id: this.getView().getId(),
                    name: "sap.kt.com.minihrsolution.fragment.ExpenseDetail",
                    controller: this
                });
                this.getView().addDependent(this._oExpenseDialog);
            }
            this._oExpenseDialog.open();
        },
        onExpenseChartSelect: function(oEvent) {
            const oCtx = oEvent.getParameter("data")[0].data;
            const sType = oCtx["Expense Type"] || oCtx.ExpenseType;
            const oResponse = this._oFullExpenseData;
            let aRecords = [];
            if (sType === this.i18n.getText("companyExpense")) {
                aRecords = oResponse?.PaymentBreakdown?.CompanyRecords || [];
            } else if (sType === this.i18n.getText("pendingExpense")) {
                aRecords = oResponse?.PaymentBreakdown?.PendingRecords || [];
            } else if (sType === this.i18n.getText("reimbursementAmount")) {
                aRecords = oResponse?.PaymentBreakdown?.ReimbursementRecords || [];
            }
            this._openExpenseDialog(this.i18n.getText("paymentBreakdown"), aRecords);
        },
        onMonthlyChartSelect: function(oEvent) {
            const oCtx = oEvent.getParameter("data")[0].data;
            const sMonth = oCtx.Month;
            const aMonthly = this._oFullExpenseData?.MonthlyTrend || [];
            const oSelected = aMonthly.find(item => item.Month === sMonth);
            this._openExpenseDialog(this.i18n.getText("monthlyExpenseTrend"), oSelected?.Records || []);
        },
        onTripChartSelect: function(oEvent) {
            const oCtx = oEvent.getParameter("data")[0].data;
            const sTrip = oCtx["Trip Type"];
            const aTrip = this._oFullExpenseData?.TripTypeData || [];
            const oSelected = aTrip.find(item => item.TripType === sTrip);
            this._openExpenseDialog(this.i18n.getText("tripTypeAnalysis"), oSelected?.Records || []);
        },
        onTilePress: async function(oEvent) {
            if (!this._oExpenseDialog) {
                this._oExpenseDialog = await sap.ui.core.Fragment.load({
                    id: this.getView().getId(),
                    name: "sap.kt.com.minihrsolution.fragment.ExpenseDetail",
                    controller: this
                });
                this.getView().addDependent(this._oExpenseDialog);
            }
            const sType = oEvent.getSource().getCustomData()[0].getValue();
            const oData = this.getView().getModel("EE_ExpenseBarChartModel").getData()?.First4Card;
            let aRecords = [];
            let fGrandTotal = 0;
            let sTitle = "";
            switch (sType) {
                case "TOTAL":
                    aRecords = oData?.TotalRecords || [];
                    fGrandTotal = oData?.TotalAmount || 0;
                    sTitle = this.i18n.getText("totalExpenseDetails");
                    break;
                case "COMPANY":
                    aRecords = oData?.CompanyRecords || [];
                    fGrandTotal = oData?.CompanyAmount || 0;
                    sTitle = this.i18n.getText("companyExpenseDetails");
                    break;
                case "PENDING":
                    aRecords = oData?.PendingRecords || [];
                    fGrandTotal = oData?.PendingAmount || 0;
                    sTitle = this.i18n.getText("pendingExpenseDetails");
                    break;
                case "REIMBURSEMENT":
                    aRecords = oData?.ReimbursementRecords || [];
                    fGrandTotal = oData?.ReimbursementAmount || 0;
                    sTitle = this.i18n.getText("reimbursementExpenseDetails");
                    break;
                default:
                    aRecords = [];
                    fGrandTotal = 0;
                    sTitle = "";
                    break;
            }
            this.getView().setModel(new JSONModel({
                dialogTitle: sTitle,
                items: aRecords,
                GrandTotal: fGrandTotal
            }), "detailModel");
            this._oExpenseDialog.open();
        },
        _navigateToExpenseDetails: function(sExpenseID) {
            if (!sExpenseID) {
                MessageToast.show("Expense ID missing");
                return;
            }
            if (this._oExpenseDialog) {
                this._oExpenseDialog.close();
            }
            this.getRouter().navTo("RouteExpensDetails", {
                sPath: sExpenseID,
                dash: "EmpExpense"
            });
        },
        EDF_onExpenseTableRowPress: function(oEvent) {
            const oRowData = oEvent.getSource().getBindingContext("detailModel").getObject();
            this._navigateToExpenseDetails(oRowData.ExpenseID);
        },
        onTopExpenseRowPress: function(oEvent) {
            const oItem = oEvent.getParameter("listItem");
            const oRowData = oItem.getBindingContext("EE_ExpenseChartModel").getObject();
            this._navigateToExpenseDetails(oRowData.ExpenseID);
        },
        EE_onGlobalSearch: function(oEvent) {
            var sQuery = oEvent.getParameter("newValue") || "";
            var oTable = this.byId("EE_id_TopExpenseTable");
            if (!oTable) {
                return;
            }
            var oBinding = oTable.getBinding("items");
            if (!oBinding) {
                return;
            }
            if (!sQuery) {
                oBinding.filter([]);
                return;
            }
            var aFilters = [
                new Filter("ExpenseName", FilterOperator.Contains, sQuery),
                new Filter("EmployeeName", FilterOperator.Contains, sQuery),
                new Filter("CostCenter", FilterOperator.Contains, sQuery),
                new Filter("TripType", FilterOperator.Contains, sQuery),
                new Filter("TotalAmount", FilterOperator.Contains, sQuery)
            ];
            oBinding.filter(new Filter({
                filters: aFilters,
                and: false
            }));
        },
        onCloseDialog: function() {
            if (this._oExpenseDialog) {
                this._oExpenseDialog.close();
            }
        },
        EE_onPress: function() {
            this.getRouter().navTo("RouteExpensePage", {
                FileName: "ExpenseApplication"
            });
        },
        onLogout: function() {
            this.CommonLogoutFunction();
        }
    });
});