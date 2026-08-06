sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "../model/formatter",
    "sap/ui/core/Fragment",
    "sap/m/MessageBox",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/Filter",
    "sap/viz/ui5/format/ChartFormatter",
    "sap/viz/ui5/api/env/Format"

], function (BaseController, JSONModel, formatter, Fragment, MessageBox, FilterOperator, Filter, ChartFormatter,
    Format) {
    "use strict";

    return BaseController.extend("sap.kt.com.minihrsolution.controller.ExpenseDashBoard", {
        formatter: formatter,
        onInit: function () {
            this.getRouter().getRoute("RouteExpensedashboard").attachMatched(this._onRouteMatched, this);
            Format.numericFormatter(ChartFormatter.getInstance());

            ChartFormatter.getInstance().registerCustomFormatter("INR_FORMAT", function (value) {
                return Number(value).toLocaleString("en-IN") + " INR";
            });
        },

        _onRouteMatched: async function () {
            var LoginFUnction = await this.commonLoginFunction("Expense");
            if (!LoginFUnction) return;
            const oLoginModel = this.getOwnerComponent().getModel("LoginModel");
            this.i18nModel = this.getView().getModel("i18n").getResourceBundle();
            this.getView().setModel(new JSONModel({
        showGraph: false
    }), "viewModel");
            this.getView().getModel("LoginModel").setProperty("/HeaderName", this.i18nModel.getText("expensedashboard"));
            await this._loadFinancialYearData();
        },

        _loadFinancialYearData: async function () {
            try {
                const oToday = new Date();
                let iYear = oToday.getFullYear();

                // Financial Year: Apr 1 to Mar 31
                let dStartDate, dEndDate;

                if (oToday.getMonth() >= 3) { // Apr-Dec
                    dStartDate = new Date(iYear, 3, 1);      // 01-Apr-current year
                    dEndDate = new Date(iYear + 1, 2, 31);   // 31-Mar-next year
                } else { // Jan-Mar
                    dStartDate = new Date(iYear - 1, 3, 1);  // 01-Apr-previous year
                    dEndDate = new Date(iYear, 2, 31);       // 31-Mar-current year
                }

                let jsonData = {
                    startDate: dStartDate.toISOString().split("T")[0],
                    endDate: dEndDate.toISOString().split("T")[0]
                };

                // Set DateRangeSelection value
                let oDateRange = this.byId("idFinancialYear");
                if (oDateRange) {
                    oDateRange.setDateValue(dStartDate);
                    oDateRange.setSecondDateValue(dEndDate);
                }
                this.getBusyDialog();
                let oResponse = await this.ajaxCreateWithJQuery(
                    "Admin_First_BarChart", jsonData
                );
                var oData = {
                    First4Card: oResponse.First4Card,
                    PaymentBreakdown: oResponse.PaymentBreakdown,
                    PreviousFinancialYearCard: oResponse.PreviousFinancialYearCard,
                    ByExpenseType: oResponse.ByExpenseType,
                    MonthlyTrend: oResponse.MonthlyTrend,
                    EmployeeExpenses: oResponse.EmployeeExpenses,
                    TripTypeData: oResponse.TripTypeData,

                    PaymentReimbursementAmount: oResponse.PaymentBreakdown.ReimbursementAmount,
                    PaymentPendingAmount: oResponse.PaymentBreakdown.PendingAmount,
                    PaymentOpenAmount: oResponse.First4Card.OpenAmount,

                    PreFinancialYear: oResponse.PreviousFinancialYearCard.FinancialYear,
                    PreTotalAmount: oResponse.PreviousFinancialYearCard.TotalAmount,
                    PreReimbursementAmount: oResponse.PreviousFinancialYearCard.ReimbursementAmount,
                    PrePendingAmount: oResponse.PreviousFinancialYearCard.PendingAmount,
                    PreOpenAmount: oResponse.PreviousFinancialYearCard.OpenAmount,

                    TotalExpenseCount: (oResponse.First4Card.TotalAmountRecords || []).length,
                    PendingCount: (oResponse.First4Card.PendingRecords || []).length,
                    ReimbursementCount: (oResponse.First4Card.ReimbursementRecords || []).length,

                    CompanyRecords: oResponse.First4Card.CompanyRecords,
                    PendingRecords: oResponse.First4Card.PendingRecords,
                    ReimbursementRecords: oResponse.First4Card.ReimbursementRecords
                };
                var oDashboardModel = new JSONModel(oData);
                this.closeBusyDialog();
                this.getView().setModel(oDashboardModel, "DashboardModel");
                // Donut Chart Model
                let aPaymentData = [
                    {
                        Type: "Open Expense",
                        Amount: oResponse.PaymentBreakdown.openAmount

                    },
                    {
                        Type: "Pending Expense",
                        Amount: oResponse.PaymentBreakdown.PendingAmount
                    },
                    {
                        Type: "Paid Expense",
                        Amount: oResponse.PaymentBreakdown.ReimbursementAmount
                    }

                ];

                this.getView().setModel(
                    new sap.ui.model.json.JSONModel({
                        PaymentData: aPaymentData,
                        Total:
                            oResponse.PaymentBreakdown.ReimbursementAmount +
                            oResponse.PaymentBreakdown.PendingAmount +
                            oResponse.PaymentBreakdown.openAmount

                    }),
                    "PaymentChartModel"
                );

                var oVizFrame = this.byId("monthlyExpenseChart");

                if (oVizFrame) {
                    oVizFrame.setVizProperties({
                        title: {
                            visible: false
                        },
                        plotArea: {
                            dataLabel: {
                                visible: true,
                                formatString: "INR_FORMAT"
                            }
                        },
                        valueAxis: {
                            label: {
                                formatString: "INR_FORMAT"
                            }
                        },
                        categoryAxis: {
                            title: {
                                visible: false
                            }
                        },
                        legend: {
                            visible: false
                        }
                    });
                }
                var oTripChart = this.byId("tripTypeBarChart");

                if (oTripChart) {
                    oTripChart.setVizProperties({
                        title: {
                            visible: false
                        },
                        plotArea: {
                            dataLabel: {
                                visible: true,
                                formatString: "INR_FORMAT"
                            },
                            colorPalette: [
                                "#43A047",
                                "#FB8C00"
                            ]
                        },
                        valueAxis: {
                            title: {
                                visible: false
                            },
                            label: {
                                formatString: "INR_FORMAT"
                            }
                        },
                        categoryAxis: {
                            title: {
                                visible: false
                            }
                        },
                        legend: {
                            visible: false
                        }
                    });
                }

                var oPaymentChart = this.byId("paymentDonutChart");

                if (oPaymentChart) {
                    oPaymentChart.setVizProperties({
                        title: {
                            visible: false
                        },
                        legend: {
                            visible: true
                        },
                        plotArea: {
                            dataLabel: {
                                visible: true,
                                type: "value",
                                formatString: "INR_FORMAT"
                            },
                            colorPalette: [
                                "#168eff",
                                "#c62828",  // Pending
                                "#43A047", // Reimbursement
                                
                            ]
                        }
                    });
                }

            } catch (error) {
                this.closeBusyDialog();
            }
        },


        onMonthlyExpenseChartSelect: function (oEvent) {

            var aData = oEvent.getParameter("data");

            if (!aData || !aData.length) {
                return;
            }

            var sMonth = aData[0].data.Month;

            var oDashboardModel = this.getView().getModel("DashboardModel");
            var aMonthlyTrend = oDashboardModel.getProperty("/MonthlyTrend") || [];

            var oMonthData = aMonthlyTrend.find(function (oItem) {
                return oItem.Month === sMonth;
            });

            if (!oMonthData) {
                return;
            }

            var oDialogModel = this.getView().getModel("DialogModel");

            if (!oDialogModel) {
                oDialogModel = new JSONModel();
                this.getView().setModel(oDialogModel, "DialogModel");
            }

            oDialogModel.setData({
                Title: sMonth + " Expenses",
                Records: oMonthData.Records,
                Amount: oMonthData.TotalAmount || 0
            });

            this._openPaymentDialog();
        },
        onTripTypeBarChartSelect: function (oEvent) {

            var aData = oEvent.getParameter("data");

            if (!aData || !aData.length) {
                return;
            }
            var sTripType = aData[0].data["Trip Type"];
            var oDashboardModel = this.getView().getModel("DashboardModel");
            var aTripTypeData = oDashboardModel.getProperty("/TripTypeData") || [];

            var oTripData = aTripTypeData.find(function (oItem) {
                return oItem.TripType === sTripType;
            });

            if (!oTripData) {
                return;
            }

            var oDialogModel = this.getView().getModel("DialogModel");

            if (!oDialogModel) {
                oDialogModel = new JSONModel();
                this.getView().setModel(oDialogModel, "DialogModel");
            }

            oDialogModel.setData({
                Title: sTripType + " Expenses",
                Records: oTripData.Records,
                Amount: oTripData.Amount
            });

            this._openPaymentDialog();
        },

        onPaymentChartSelect: function (oEvent) {

            var aData = oEvent.getParameter("data");

            if (!aData || !aData.length) {
                return;
            }

            var sType = aData[0].data["Payment Type"];

            switch (sType) {

                case "Company":
                    this.onOpenPaymentDialog("COMPANY");
                    break;

                case "Pending":
                    this.onOpenPaymentDialog("PENDING");
                    break;

                case "Reimbursement":
                    this.onOpenPaymentDialog("REIMBURSEMENT");
                    break;
                case "Open Expense":
                    this.onOpenPaymentDialog("OPENAMOUNT");
                    break;
            }
        },
        onSearchDashboard: async function () {

            var oDateRange = this.byId("idFinancialYear");

            var dFrom = oDateRange.getDateValue();
            var dTo = oDateRange.getSecondDateValue();

            if (!dFrom || !dTo) {
                MessageToast.show("Please select a date range");
                return;
            }

            var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
                pattern: "yyyy-MM-dd"
            });

            var jsonData = {
                startDate: oDateFormat.format(dFrom),
                endDate: oDateFormat.format(dTo)
            };

            try {

                this.getBusyDialog();

                var oResponse = await this.ajaxCreateWithJQuery(
                    "Admin_First_BarChart",
                    jsonData
                );

                var oDashboardModel = new sap.ui.model.json.JSONModel(oResponse);
                const oPreviousFY = oResponse.PreviousFinancialYearCard || {};
                const oFourcard = oResponse.First4Card || {};

                oResponse.PreFinancialYear = oPreviousFY.FinancialYear;
                oResponse.PreTotalAmount = oPreviousFY.TotalAmount;
                oResponse.PreReimbursementAmount = oPreviousFY.ReimbursementAmount;
                oResponse.PrePendingAmount = oPreviousFY.PendingAmount;
                oResponse.PreOpenAmount = oPreviousFY.OpenAmount;

                 // Record Counts
        oResponse.PendingCount = (oFourcard.PendingRecords || []).length;
        oResponse.ReimbursementCount = (oFourcard.ReimbursementRecords || []).length;
        oResponse.TotalExpenseCount = (oFourcard.TotalExpenseRecords || []).length; // if available
        oResponse.OpenCount = (oFourcard.OpenRecords || []).length; // if available
 
                this.getView().setModel(oDashboardModel, "DashboardModel");

            } catch (oError) {
                this.closeBusyDialog();
                MessageBox.error("Failed to load dashboard data");
            } finally {
                this.closeBusyDialog();
            }
        },
        onClearFilters: function () {

            this.byId("idFinancialYear").setDateValue(null);
            this.byId("idFinancialYear").setSecondDateValue(null);
        },

        onPressback() {
            this.getRouter().navTo("RouteTilePage");
        },
        onLogout: function () {
            var that = this
            that.CommonLogoutFunction();
        },
        onAfterRendering: function () {

            var oVizFrame = this.byId("paymentDonutChart");

            oVizFrame.setVizProperties({
                plotArea: {
                    colorPalette: [
                        "#107E3E", // Company
                        "#BB0000"  // Pending
                    ],
                    dataLabel: {
                        visible: true
                    }
                },
                legend: {
                    visible: true
                }
            });
            this.byId("employeeDonutChart").addFeed(
    new sap.viz.ui5.controls.common.feeds.FeedItem({
        uid: "size",
        type: "Measure",
        values: ["Expense Amount"]
    })
);

this.byId("employeeDonutChart").addFeed(
    new sap.viz.ui5.controls.common.feeds.FeedItem({
        uid: "color",
        type: "Dimension",
        values: ["Employee"]
    })
);
this.byId("employeeLineChart").addFeed(
    new sap.viz.ui5.controls.common.feeds.FeedItem({
        uid: "valueAxis",
        type: "Measure",
        values: ["Expense Amount"]
    })
);

this.byId("employeeLineChart").addFeed(
    new sap.viz.ui5.controls.common.feeds.FeedItem({
        uid: "categoryAxis",
        type: "Dimension",
        values: ["Employee"]
    })
);

        },
        getCategoryState: function (sType) {
            switch (sType) {
                case "Peridiem":
                    return "Success";
                case "Hotel":
                    return "Information";
                case "Telephone":
                    return "Warning";
                case "Air":
                    return "Error";
                default:
                    return "None";
            }
        },

        onOpenPaymentDialog: function (sType) {

            var oDashboardModel = this.getView().getModel("DashboardModel");
            var oDialogModel = this.getView().getModel("DialogModel");

            if (!oDialogModel) {
                oDialogModel = new JSONModel();
                this.getView().setModel(oDialogModel, "DialogModel");
            }

            switch (sType) {

                case "PENDING":
                    oDialogModel.setData({
                        Title: "Pending",
                        Records: oDashboardModel.getProperty("/PendingRecords"),
                        Amount: oDashboardModel.getProperty("/First4Card/PendingAmount"),
                        ShowStatus: true
                    });
                    break;

                case "REIMBURSEMENT":
                    oDialogModel.setData({
                        Title: "Reimbursement",
                        Records: oDashboardModel.getProperty("/ReimbursementRecords"),
                        Amount: oDashboardModel.getProperty("/First4Card/ReimbursementAmount"),
                        ShowStatus: true
                    });
                    break;
                case "OPENAMOUNT":
                    oDialogModel.setData({
                        Title: "Open Expense",
                        Records: oDashboardModel.getProperty("/First4Card/OpenRecords"),
                        Amount: oDashboardModel.getProperty("/First4Card/OpenAmount"),
                        ShowStatus: true
                    });
                    break;
                case "TOTAL":

                    var aTotalCompany = oDashboardModel.getProperty("/First4Card/TotalAmountRecords") || [];

                    var aCombined = [];

                    aTotalCompany.forEach(function (oItem) {
                        aCombined.push(Object.assign({}, oItem, {
                            GroupType: "Total Expenses"
                        }));
                    });

                    oDialogModel.setData({
                        Title: "Total Expenses",
                        Records: aCombined,
                        Amount: oDashboardModel.getProperty("/First4Card/TotalAmount")
                    });

                    break;
            }

            this._openPaymentDialog();
        },
        _openPaymentDialog: function () {

            var oView = this.getView();

            if (!this._oPaymentDialog) {
                this._oPaymentDialog = Fragment.load({
                    id: oView.getId(),
                    name: "sap.kt.com.minihrsolution.fragment.ExpDashboard-Companypaid",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }

            this._oPaymentDialog.then(function (oDialog) {
                oDialog.open();

                if (this._sDialogType === "TOTAL") {

                    var oTable = sap.ui.getCore().byId(
                        oView.getId() + "--idExpenseTable"
                    );

                    var oBinding = oTable.getBinding("items");

                    oBinding.sort(
                        new sap.ui.model.Sorter(
                            "GroupType",
                            false,
                            function (oContext) {
                                return {
                                    key: oContext.getProperty("GroupType"),
                                    text: oContext.getProperty("GroupType")
                                };
                            }
                        )
                    );
                }
            }.bind(this));
        },

        onCompanyPaidTilePress: function () {
            this.onOpenPaymentDialog("COMPANY");
        },
        onReimbursementTilePress: function () {
            this.onOpenPaymentDialog("REIMBURSEMENT");
        },
        onPendingTilePress: function () {
            this.onOpenPaymentDialog("PENDING");
        },
        onOpenexpenseTilePress: function () {
            this.onOpenPaymentDialog("OPENAMOUNT");
        },
        onTotalExpenseTilePress: function () {
            this.onOpenPaymentDialog("TOTAL");
        },
        onCloseDialog: function () {
            this._oPaymentDialog.then(function (oDialog) {
                oDialog.close();
            });
        },

        onGlobalSearch: function (oEvent) {

            var sQuery = oEvent.getParameter("newValue") || "";
            var oTable = this.byId("idTop10ExpensesTable");

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
                new Filter("EmployeeName", FilterOperator.Contains, sQuery),
                new Filter("TotalAmount", FilterOperator.Contains, sQuery),
            ];

            oBinding.filter(
                new sap.ui.model.Filter({
                    filters: aFilters,
                    and: false
                })
            );
        },

        onPressTableItem: function (oEvent) {

            var ExpenseID = oEvent.getSource().getBindingContext("DialogModel").getObject().ExpenseID;
            this.getRouter().navTo("RouteExpensDetails", {
                sPath: ExpenseID.replaceAll("/", ""),
                dash: "ExpenseDashboard"
            });
        },

        onPressTop10Item: function (oEvent) {
            var ExpenseID = oEvent.getSource().getBindingContext("DashboardModel").getObject().ExpenseID;
            this.getRouter().navTo("RouteExpensDetails", {
                sPath: ExpenseID.replaceAll("/", ""),
                dash: "ExpenseDashboard"
            });
        },
      ED_onShowEmployeeExp: function (oEvent) {

    var oEmployee = null;

    // Called from Table Button
    if (oEvent.getSource().getBindingContext) {

        var oContext = oEvent.getSource().getBindingContext("DashboardModel");

        if (oContext) {
            oEmployee = oContext.getObject();
        }
    }

    // Called from VizFrame (Donut/Line)
    if (!oEmployee && oEvent.getParameter("data")) {

        var aData = oEvent.getParameter("data");

        if (aData.length) {

            var sEmployee = aData[0].data.Employee;

            var aEmployees = this.getView()
                .getModel("DashboardModel")
                .getProperty("/EmployeeExpenses");

            oEmployee = aEmployees.find(function (o) {
                return o.EmployeeName === sEmployee;
            });
        }
    }

    if (!oEmployee) {
        return;
    }

    var oDialogModel = this.getView().getModel("DialogModel");

    if (!oDialogModel) {
        oDialogModel = new JSONModel();
        this.getView().setModel(oDialogModel, "DialogModel");
    }

    oDialogModel.setData({
        Title: oEmployee.EmployeeName + " Expenses",
        Records: oEmployee.records || [],
        Amount: oEmployee.TotalAmount,
        ShowStatus: true
    });

    this._openPaymentDialog();
},
ED_onClickEmpExp: function () {

    var oVM = this.getView().getModel("viewModel");
    var bShow = oVM.getProperty("/showGraph");

    oVM.setProperty("/showGraph", !bShow);

    if (!bShow) {
       setTimeout(function () {
            this._bindEmployeeExpenseCharts();
        }.bind(this), 100);
    }
},
_bindEmployeeExpenseCharts: function () {

    var FeedItem = sap.viz.ui5.controls.common.feeds.FeedItem;

    // ---------------- Donut ----------------
    var oDonut = this.byId("employeeDonutChart");

    oDonut.removeAllFeeds();

    oDonut.addFeed(new FeedItem({
        uid: "size",
        type: "Measure",
        values: ["Expense Amount"]
    }));

    oDonut.addFeed(new FeedItem({
        uid: "color",
        type: "Dimension",
        values: ["Employee"]
    }));

    oDonut.setVizProperties({
        title: {
            visible: false,
        },
        legend: {
            visible: true
        },
        plotArea: {
        dataLabel: {
            visible: true,
            type: "value",          // Show value instead of percentage
            formatString: "INR_FORMAT"
        }
    },
    tooltip: {
        visible: true,
        formatString: "INR_FORMAT"
    }
    });

    // ---------------- Line ----------------
    var oLine = this.byId("employeeLineChart");

    oLine.removeAllFeeds();

    oLine.addFeed(new FeedItem({
        uid: "valueAxis",
        type: "Measure",
        values: ["Expense Amount"]
    }));

    oLine.addFeed(new FeedItem({
        uid: "categoryAxis",
        type: "Dimension",
        values: ["Employee"]
    }));

    oLine.setVizProperties({
        title: {
            visible: false,
            
        },
        plotArea: {
            dataLabel: {
                visible: true,
                 formatString: "INR_FORMAT"
            }
        },
         tooltip: {
        visible: true,
        formatString: "INR_FORMAT"
    },
        valueAxis: {
            title: {
                visible: true,
                text: "Amount"
            }
        },
        categoryAxis: {
            title: {
                visible: true,
                text: "Employee"
            }
        }
    });

}
    });
});