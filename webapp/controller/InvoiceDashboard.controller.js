sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment",
    "../model/formatter",
], function (BaseController, JSONModel, MessageToast, Fragment, Formatter) {
    "use strict";
    const INITIAL_CHART_TYPES = { statusType: "donut", monthlyType: "line", companyType: "bar", yearlyType: "line", paymentBreakdownType: "bar", pendingByCompanyType: "bar" };
    return BaseController.extend("sap.kt.com.minihrsolution.controller.InvoiceDashboard", {
        Formatter: Formatter,
        onInit: function () {
            this.getView().setModel(new JSONModel(INITIAL_CHART_TYPES), "invoiceChartTypeModel");
            this.getOwnerComponent().getRouter().getRoute("RouteInvoiceDashboard").attachPatternMatched(this._onObjectMatched, this);
            this.getView().setModel(new JSONModel([]), "companies");
            this.getOwnerComponent().getRouter().getRoute("RouteInvoiceDashboard").attachPatternMatched(this._onObjectMatched, this);
        },

        _onObjectMatched: async function () {
            var LoginFUnction = await this.commonLoginFunction("InvoiceDashboard");//CompanyInvoice
            if (!LoginFUnction) return;
            this.getView().getModel("LoginModel").setProperty("/HeaderName", "Invoice Dashboard");
            this.i18nModel = this.getView().getModel("i18n").getResourceBundle();
            this.getView().getModel("invoiceChartTypeModel").setData(JSON.parse(JSON.stringify(INITIAL_CHART_TYPES)));
            this.invoiceChartTypeModel = this.getView().getModel("invoiceChartTypeModel")

            var oJsonModel = new JSONModel({
                Chart1: [], Chart2: [], Chart3: [], Chart4: [], Chart5: [], Chart6: [], Chart7: [], Chart8: [], PaymentDetails: []
            });
            this.getView().setModel(oJsonModel, "InvoiceDashboardModel");
            this.InvoiceDashboardModel = this.getView().getModel("InvoiceDashboardModel");
            await this.onFilterChange();
            await this.ajaxReadWithJQuery("ManageCustomer", {}).then((oData) => {
                var companyData = Array.isArray(oData.data) ? oData.data : [oData.data];
                var oJsonModel = new JSONModel(companyData);
                this.getView().setModel(oJsonModel, "companies");
            }).catch((error) => {
                sap.m.MessageToast.show(error.message || error.responseText);
            }).finally(() => {
                this.closeBusyDialog();
            });
        },
        onFilterChange: async function () {
            try {
                const oCompanyFilter = this.byId("companyFilter");
                const oYearFilter = this.byId("yearFilter");
                const oDateRange = this.byId("DashI_id_Date");

                const aSelectedCompanies = oCompanyFilter.getSelectedKeys();
                let sSelectedYear = oYearFilter.getValue();
                let dFrom = oDateRange.getDateValue();
                let dTo = oDateRange.getSecondDateValue();

                let filters = { CustomerName: aSelectedCompanies.join(",") };

                // ✅ Common Date Formatter (move outside)
                const formatDate = (date) => {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                };

                // 1️⃣ If Date Range selected
                if (dFrom && dTo) {
                    this.byId("yearFilter").setValue("");

                    filters.InvoiceStartDate = formatDate(dFrom);   // ✅ FIXED
                    filters.InvoiceEndDate = formatDate(dTo);       // ✅ FIXED
                }
                else {
                    let startYear;

                    if (sSelectedYear) {
                        startYear = parseInt(sSelectedYear);
                    } else {
                        // ✅ Get Current Financial Year
                        const today = new Date();
                        startYear = today.getMonth() >= 3
                            ? today.getFullYear()
                            : today.getFullYear() - 1;
                    }

                    const endYear = startYear + 1;
                    this.byId("yearFilter").setValue(startYear + " - " + endYear);

                    const fyStart = new Date(startYear, 3, 1);  // April 1
                    const fyEnd = new Date(endYear, 2, 31);     // March 31

                    filters.InvoiceStartDate = formatDate(fyStart);
                    filters.InvoiceEndDate = formatDate(fyEnd);
                }

                this.getBusyDialog(); // <-- Open custom BusyDialog
                var response = await this.ajaxCreateWithJQuery("InvoiceStatusOverview", filters);
                this.InvoiceDashboardModel.setProperty("/Chart1", response.data);
                this.InvoiceDashboardModel.setProperty("/Chart2", response.MonthlyChartData);
                this.InvoiceDashboardModel.setProperty("/Chart3", response.CompanyWiseData);
                this.InvoiceDashboardModel.setProperty("/Chart5", response.paymentBreakdownMap);
                this.InvoiceDashboardModel.setProperty("/Chart6", response.PendingInvoice);

                var responseData = await this.ajaxCreateWithJQuery("getCompanyInvoiceYearlyTrend", filters);
                this.InvoiceDashboardModel.setProperty("/Chart4", responseData.data);
                this.InvoiceDashboardModel.setProperty("/PaymentDetails", responseData.AllPaymentDetails);

                var responseCreditNote = await this.ajaxCreateWithJQuery("getCreditNoteBarChartData", filters);
                this.InvoiceDashboardModel.setProperty("/Chart7", responseCreditNote.data.StatusChart);
                this.InvoiceDashboardModel.setProperty("/Chart8", responseCreditNote.data.MonthChart);
                this.closeBusyDialog();
            } catch (error) {
                MessageToast.show(error.message || error.responseText);
                this.closeBusyDialog();
            }
        },

        onchangeFY: function (oEvent) {
            // get selected year from DatePicker
            const sYear = oEvent.getSource().getValue();
            if (!sYear) return;
            const year = parseInt(sYear, 10);
            // Financial Year = selectedYear - (selectedYear+1)
            const financialYear = year + " - " + (year + 1);
            // set back to DatePicker as string
            this.byId("yearFilter").setValue(financialYear);
        },

        onClearFilters: function () {
            this.byId("companyFilter").setSelectedKeys(null);
            this.byId("DashI_id_Date").setValue("");

            const today = new Date();
            let year = today.getFullYear();
            let month = today.getMonth() + 1;

            let financialYear;
            if (month < 4) {
                financialYear = (year - 1) + " - " + year;
            } else {
                financialYear = year + " - " + (year + 1);
            }
            this.byId("yearFilter").setValue(financialYear);
        },

        // First chart click event handler
        onStatusChartSelect: function (oEvent) {
            const oData = oEvent.getParameter("data")?.[0];
            if (!oData || !oData.data?.Status) return;
            const sStatus = oData.data.Status;
            const aAllInvoices = this.InvoiceDashboardModel.getProperty("/Chart1/result") || [];
            const aInvoicesForStatus = aAllInvoices
                .filter(i => i.Status === sStatus)
                .sort((a, b) => new Date(b.InvoiceDate) - new Date(a.InvoiceDate));

            // Total Amount
            const iTotalAmount = aInvoicesForStatus.reduce((sum, item) => {
                return (item.Currency === "INR" ? sum + (item.TotalAmount || 0) : sum + (item.AmountInINR || 0));
            }, 0);

            // Actual Amount
            const iActualAmount = aInvoicesForStatus.reduce((sum, item) => {
                return sum + (Number(item.AllTotalAndActualAmount) || 0);
            }, 0);

            const oView = this.getView();
            if (!this._pPopover1) {
                this._pPopover1 = Fragment.load({
                    id: oView.getId(),
                    name: "sap.kt.com.minihrsolution.fragment.InvoiceListPopover",
                    controller: this
                }).then(oDialog => {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }
            this._pPopover1.then(oDialog => {
                oDialog.setModel(new JSONModel({
                    Invoices: aInvoicesForStatus,
                    status: sStatus,
                    AllTotalAmount: iTotalAmount,
                    AllActualAmount: iActualAmount
                }), "popoverData");
                oDialog.open(); // Dialog, not Popover
            });
        },
        onCloseDialog: function (oEvent) {
            oEvent.getSource().getParent().getParent().close();
        },
        onInvoicePaymentAmountPress: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext("popoverData");
            this.onCommonPaymentAmountPress(oContext, oEvent.getSource());
        },
        onInvoiceNumberPress: function (oEvent) {
            this.getRouter().navTo("RouteCompanyInvoiceDetails", { sPath: encodeURIComponent(oEvent.getSource().getBindingContext("popoverData").getObject().InvNo), dash: "InvoiceDashboard" });
        },
        onPressFirstChart: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("popoverData");
            this.onCommonCreditNotesPress(oContext);
        },


        //Second chart click event handler
        onMonthlyInvoiceSelect: function (oEvent) {
            const oData = oEvent.getParameter("data")?.[0];
            if (!oData || !oData.data?.Month) return;
            const Month = oData.data.Month;
            const aAllInvoices = this.getView().getModel("InvoiceDashboardModel").getProperty("/Chart2") || [];
            const aFiltered = aAllInvoices.filter(i => i.Month === Month);
            if (!aFiltered.length || !aFiltered[0].Records) return;

            const aInvoicesForMonthly = aFiltered[0].Records.sort((a, b) => new Date(b.InvoiceDate) - new Date(a.InvoiceDate));

            const iTotalAmount = aInvoicesForMonthly.reduce((sum, item) => {
                return sum + (item.Currency === "INR" ? (item.TotalAmount || 0) : (item.AmountInINR || 0));
            }, 0);

            const iActualAmount = aInvoicesForMonthly.reduce((sum, item) => {
                return sum + (Number(item.AllTotalAndActualAmount) || 0);
            }, 0);

            const oView = this.getView();
            if (!this._pPopover2) {
                this._pPopover2 = Fragment.load({
                    id: oView.getId(),
                    name: "sap.kt.com.minihrsolution.fragment.MonthlyInvoice",
                    controller: this
                }).then(oDialog => {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }
            this._pPopover2.then(oDialog => {
                oDialog.setModel(new JSONModel({
                    Invoices: aInvoicesForMonthly,
                    Month: Month,
                    AllTotalAmount: iTotalAmount,
                    AllActualAmount: iActualAmount
                }), "MonthlyInvoiceData");
                oDialog.open(); // Dialog, not Popover
            });
        },
        onCloseDialog: function (oEvent) {
            oEvent.getSource().getParent().getParent().close();
        },

        onInvoiceCreditNotesMonthlyPress: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("MonthlyInvoiceData");
            this.onCommonCreditNotesPress(oContext);
        },
        onMonthlyPaymentAmountPress: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("MonthlyInvoiceData");
            this.onCommonPaymentAmountPress(oContext, oEvent.getSource());
        },
        onPressMonthlyListItem: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext("MonthlyInvoiceData");
            if (!oContext) return;
            const oData = oContext.getObject();
            if (!oData || !oData.InvNo) return;
            this.getRouter().navTo("RouteCompanyInvoiceDetails", { sPath: encodeURIComponent(oData.InvNo), dash: "InvoiceDashboard" });
        },


        //Third chart click event handler
        onTotalInvoiceValueSelect: function (oEvent) {
            const oData = oEvent.getParameter("data")?.[0];
            if (!oData || !oData.data?.Company) return;
            const sCompany = oData.data.Company;
            const aAllCompanies = this.InvoiceDashboardModel.getProperty("/Chart3") || [];
            const oCompanyData = aAllCompanies.find(c => c.CompanyName === sCompany);
            if (!oCompanyData) return;
            const aCompanyRecords = oCompanyData.Records || [];

            aCompanyRecords.sort((a, b) => new Date(b.InvoiceDate) - new Date(a.InvoiceDate));

            const iTotalAmount = aCompanyRecords.reduce((sum, item) => {
                return sum + Number(item.ActualAmount || 0);
            }, 0);

            const iActualAmount = aCompanyRecords.reduce((sum, item) => {
                return sum + (Number(item.AllTotalAndActualAmount) || 0);
            }, 0);

            const oView = this.getView();
            if (!this._pCompanyPopover) {
                this._pCompanyPopover = Fragment.load({
                    id: oView.getId(),
                    name: "sap.kt.com.minihrsolution.fragment.TotalInVoiceValue",
                    controller: this
                }).then(oDialog => {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }
            this._pCompanyPopover.then(oDialog => {
                oDialog.setModel(new JSONModel({
                    CompanyName: sCompany,
                    Records: aCompanyRecords,
                    TotalAmount: iTotalAmount,
                    AllActualAmount: iActualAmount
                }), "companyPopoverData");

                oDialog.open();
            });
        },
        onPressInvoiceDetails: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext("companyPopoverData");
            if (!oContext) return;
            const oData = oContext.getObject();
            if (!oData || !oData.InvNo) return;
            this.getRouter().navTo("RouteCompanyInvoiceDetails", { sPath: encodeURIComponent(oData.InvNo), dash: "InvoiceDashboard" });
        },

        onTotalVoicePaymentAmountPress: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("companyPopoverData");
            this.onCommonCreditNotesPress(oContext);
        },
        onPressActualAmount: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("companyPopoverData");
            this.onCommonPaymentAmountPress(oContext, oEvent.getSource());
        },

        //Fourth chart click event handler - Yearly Invoice Trend
        onYearlyInvoiceSelect: function (oEvent) {
            const oData = oEvent.getParameter("data")?.[0];
            if (!oData || !oData.data?.Year) return;
            const sYear = oData.data.Year;
            // get yearly data from model
            const aAllYears = this.InvoiceDashboardModel.getProperty("/Chart4") || [];
            // find selected year object
            const oYearData = aAllYears.find(y => y.Year === sYear);
            if (!oYearData) return;
            const aYearRecords = oYearData.Records || [];
            // sort by InvoiceDate desc
            aYearRecords.sort((a, b) => new Date(b.InvoiceDate) - new Date(a.InvoiceDate));
            // calculate total
            const iTotalAmount = aYearRecords.reduce((sum, item) => {
                return sum + Number(item.ActualAmount || 0);
            }, 0);

            const iActualAmount = aYearRecords.reduce((sum, item) => {
                return sum + (Number(item.AllTotalAndActualAmount) || 0);
            }, 0);

            const oView = this.getView();
            if (!this._pYearPopover) {
                this._pYearPopover = Fragment.load({
                    id: oView.getId(),
                    name: "sap.kt.com.minihrsolution.fragment.YearlyInvoice",
                    controller: this
                }).then(oDialog => {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }
            this._pYearPopover.then(oDialog => {
                oDialog.setModel(new JSONModel({
                    Year: sYear,
                    Records: aYearRecords,
                    TotalAmount: iTotalAmount,
                    AllActualAmount: iActualAmount
                }), "yearPopoverData");   // model name for fragment
                oDialog.open();
            });
        },
        onYearlyPaymentAmountPress: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("yearPopoverData");
            this.onCommonPaymentAmountPress(oContext, oEvent.getSource());
        },
        onInvoiceCreditNotesPress: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("yearPopoverData");
            this.onCommonCreditNotesPress(oContext);
        },

        //Fifth chart click event handler - Payment Breakdown by Company
        onPaymentBreakdownSelect: function (oEvent) {
            const oData = oEvent.getParameter("data")?.[0];
            if (!oData || !oData.data?.Company) return;
            const sCompany = oData.data.Company;
            // get yearly data from model
            const aAllYears = this.InvoiceDashboardModel.getProperty("/Chart5") || [];
            // find selected year object
            const oYearData = aAllYears[sCompany];  // since Chart5 is a map with company name as key
            if (!oYearData) return;
            const aYearRecords = oYearData.Records || [];

            const iTotalAmount = aYearRecords.reduce((sum, item) => { return sum + Number(item.TotalAmountInINR || 0) }, 0);
            const oView = this.getView();
            if (!this._pPopover5) {
                this._pPopover5 = Fragment.load({
                    id: oView.getId(),
                    name: "sap.kt.com.minihrsolution.fragment.PaymentBreakdownDetails",
                    controller: this
                }).then(oDialog => {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }
            this._pPopover5.then(oDialog => {
                oDialog.setModel(new JSONModel({
                    Company: sCompany,
                    Records: aYearRecords,
                    TotalAmount: iTotalAmount
                }), "PaymentBreakdownPopoverData");   // model name for fragment
                oDialog.open();
            });
        },
        onInvoiceCreditNotesPressPaymentBreakdown: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("PaymentBreakdownPopoverData");
            this.onCommonCreditNotesPress(oContext);
        },
        onPressInvoiceDetailsYearly: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("yearPopoverData");
            if (!oContext) return;
            const oData = oContext.getObject();
            if (!oData || !oData.InvNo) return;
            this.getRouter().navTo("RouteCompanyInvoiceDetails", { sPath: encodeURIComponent(oData.InvNo), dash: "InvoiceDashboard" });
        },
        onPaymentBreakdownPress: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("PaymentBreakdownPopoverData");
            if (!oContext) return;
            const oData = oContext.getObject();
            if (!oData || !oData.InvNo) return;
            this.getRouter().navTo("RouteCompanyInvoiceDetails", { sPath: encodeURIComponent(oData.InvNo), dash: "InvoiceDashboard" });
        },

        //Sixth chart click event handler - Pending Invoice by Company
        onPendingCompanySelect: function (oEvent) {

            const oData = oEvent.getParameter("data")?.[0];
            if (!oData || !oData.data?.Company) return;

            const CompanyName = oData.data.Company;

            const aAllInvoices = this.getView()
                .getModel("InvoiceDashboardModel")
                .getProperty("/Chart6") || [];

            const aFiltered = aAllInvoices.filter(i => i.CompanyName === CompanyName);

            if (!aFiltered.length || !aFiltered[0].Records) return;

            const aInvoicesForStatus = aFiltered[0].Records
                .sort((a, b) => new Date(b.InvoiceDate) - new Date(a.InvoiceDate));

            const iTotalAmount = aInvoicesForStatus.reduce((sum, item) => {
                return sum + (Number(item.PendingAmount || 0));
            }, 0);

            const oView = this.getView();

            if (!this._pPopover6) {
                this._pPopover6 = Fragment.load({
                    id: oView.getId(),
                    name: "sap.kt.com.minihrsolution.fragment.PendingInvoicesDialog",
                    controller: this
                }).then(oDialog => {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }

            this._pPopover6.then(oDialog => {

                oDialog.setModel(new JSONModel({
                    Invoices: aInvoicesForStatus,
                    CompanyName: CompanyName,
                    AllTotalAmount: iTotalAmount
                }), "PendingInvoicesData");

                oDialog.open();
            });
        },

        onInvoiceCreditNotesPressPendingInvoices: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("PendingInvoicesData");
            this.onCommonCreditNotesPress(oContext);
        },
        onInvoicePressChart6: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext("PendingInvoicesData");
            if (!oContext) return;
            const oData = oContext.getObject();
            if (!oData || !oData.InvNo) return;
            this.getRouter().navTo("RouteCompanyInvoiceDetails", { sPath: encodeURIComponent(oData.InvNo), dash: "InvoiceDashboard" });
        },

        // 7 Chart click event handler
        onStatusChartSelectCreditNote: function (oEvent) {
            const oData = oEvent.getParameter("data")?.[0];
            if (!oData || !oData.data?.Status) return;
            const sStatus = oData.data.Status;
            // get yearly data from model
            const aAllYears = this.InvoiceDashboardModel.getProperty("/Chart7") || [];
            // find selected year object
            const oYearData = aAllYears.find((i) => i.Status === sStatus);
            if (!oYearData) return;
            const aYearRecords = oYearData.Records || [];

            const iTotalAmount = aYearRecords.reduce((sum, item) => { return sum + Number(item.TotalAmount || 0) }, 0);
            const oView = this.getView();
            if (!this._pPopover7) {
                this._pPopover7 = Fragment.load({
                    id: oView.getId(),
                    name: "sap.kt.com.minihrsolution.fragment.CreditNoteListPopover",
                    controller: this
                }).then(oDialog => {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }
            this._pPopover7.then(oDialog => {
                oDialog.setModel(new JSONModel({
                    Status: sStatus,
                    Records: aYearRecords,
                    TotalAmount: iTotalAmount
                }), "CreditNoteListPopoverData");   // model name for fragment
                oDialog.open();
            });
        },
        onPressCreditNoteInvoice: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext("CreditNoteListPopoverData");
            if (!oContext) return MessageToast.show("No data found for this row.");
            const oRowData = oContext.getObject();
            if (!oRowData.InvNo) return MessageToast.show("No Invoice details found for this credit note.");
            this.getRouter().navTo("RouteCreditNoteDetails", { sPath: encodeURIComponent(oRowData.CCInvNo), dash: "InvoiceDashboard" });
        },

        onMonthlyInvoiceSelectCreditNote: function (oEvent) {
            const oData = oEvent.getParameter("data")?.[0];
            if (!oData || !oData.data?.Month) return;
            const sStatus = oData.data.Month;
            // get yearly data from model
            const aAllYears = this.InvoiceDashboardModel.getProperty("/Chart8") || [];
            // find selected year object
            const oYearData = aAllYears.find((i) => i.Month === sStatus);
            if (!oYearData) return;
            const aYearRecords = oYearData.Records || [];

            const iTotalAmount = aYearRecords.reduce((sum, item) => { return sum + Number(item.TotalAmount || 0) }, 0);
            const oView = this.getView();
            if (!this._pMonthPopover) {
                this._pMonthPopover = Fragment.load({
                    id: oView.getId(),
                    name: "sap.kt.com.minihrsolution.fragment.MonthlyInvoiceCreditNote",
                    controller: this
                }).then(oDialog => {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }
            this._pMonthPopover.then(oDialog => {
                oDialog.setModel(new JSONModel({
                    Month: sStatus,
                    Records: aYearRecords,
                    TotalAmount: iTotalAmount
                }), "MonthlyListPopoverData");   // model name for fragment
                oDialog.open();
            });
        },

        onPendingInvoicePress: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext("MonthlyListPopoverData");
            if (!oContext) return;

            const oData = oContext.getObject();
            if (!oData || !oData.InvNo) return;

            this.getRouter().navTo("RouteCompanyInvoiceDetails", {
                sPath: encodeURIComponent(oData.InvNo),
                dash: "InvoiceDashboard"
            });
        },

        onCommonPaymentAmountPress: function (oEvent, oSourceControl) {
            const oContext = oEvent;
            if (oEvent.getObject().Currency && oEvent.getObject().Currency === "INR") return MessageToast.show("Sorry, payment details are not supported for INR currency. Please select another currency.");

            const aAllDetails = this.InvoiceDashboardModel.getProperty("/PaymentDetails") || [];
            const aData = aAllDetails.filter(i => i.InvNo === oContext.getObject().InvNo);
            if (!aData.length) return MessageToast.show("No payment details found.");
            this.onCommonDisplayThreeColumnPopup(aData, oSourceControl);
        },

        onCommonCreditNotesPress: function (oEvent) {
            var oContext = oEvent;
            if (!oContext) var oContext = oEvent.getSource().getBindingContext("dialogData");

            if (!oContext) return MessageToast.show("No data found for this row.");
            const oRowData = oContext.getObject();
            if (!oRowData.CCInvNo[0]) return MessageToast.show("No Credit Note details found for this invoice.");
            this.getRouter().navTo("RouteCreditNoteDetails", { sPath: encodeURIComponent(oRowData.CCInvNo[0]), dash: "InvoiceDashboard" });
        },

        onCommonDisplayThreeColumnPopup: function (aItems, oSourceControl) {
            var oModel = new JSONModel({ items: aItems });
            var oTable = new sap.m.Table({
                inset: false,
                columns: [
                    new sap.m.Column({ header: new sap.m.Text({ text: "Received Amount" }) }),
                    new sap.m.Column({ header: new sap.m.Text({ text: "Exchange Rate" }) }),
                    new sap.m.Column({ header: new sap.m.Text({ text: "Amount in INR" }) })
                ],
                items: {
                    path: "/items",
                    template: new sap.m.ColumnListItem({
                        cells: [
                            new sap.m.Text({ text: "{= ${ReceivedAmount} + ' ' + ${Currency} }" }),
                            new sap.m.Text({ text: "{ConversionRate}" }),
                            new sap.m.Text({ text: "{AmountInINR}" })
                        ]
                    })
                }
            });
            oTable.setModel(oModel);
            var oPopover = new sap.m.ResponsivePopover({
                title: "Payment Details",
                contentWidth: "500px",
                placement: sap.m.PlacementType.Left,
                content: [oTable],
                endButton: new sap.m.Button({
                    text: "Close",
                    press: function () {
                        oPopover.close();
                    }
                }),
                afterClose: function () { oPopover.destroy() }
            });
            oPopover.openBy(oSourceControl);
        },
        onLogout: function () {
            this.getOwnerComponent().getRouter().navTo("RouteLoginPage");
        },
        onPressback: function () { this.getRouter().navTo("RouteTilePage") },
        IN_onPressStatusPie: function () { this.invoiceChartTypeModel.setProperty("/statusType", "pie"); },
        IN_onPressStatusBar: function () { this.invoiceChartTypeModel.setProperty("/statusType", "bar"); },
        IN_onPressStatusDonut: function () { this.invoiceChartTypeModel.setProperty("/statusType", "donut"); },
        IN_onPressMonthlyPie: function () { this.invoiceChartTypeModel.setProperty("/monthlyType", "waterfall"); },
        IN_onPressMonthlyBar: function () { this.invoiceChartTypeModel.setProperty("/monthlyType", "bar"); },
        IN_onPressMonthlyLine: function () { this.invoiceChartTypeModel.setProperty("/monthlyType", "line"); },
        IN_onPressCompanyPie: function () { this.invoiceChartTypeModel.setProperty("/companyType", "waterfall"); },
        IN_onPressCompanyBar: function () { this.invoiceChartTypeModel.setProperty("/companyType", "bar"); },
        IN_onPressYearlyBar: function () { this.invoiceChartTypeModel.setProperty("/yearlyType", "bar"); },
        IN_onPressYearlyLine: function () { this.invoiceChartTypeModel.setProperty("/yearlyType", "line"); },
        onPressPaymentStackedColumn: function () { this.invoiceChartTypeModel.setProperty("/paymentBreakdownType", "stacked_bar"); },
        onPressPaymentStackedBar: function () { this.invoiceChartTypeModel.setProperty("/paymentBreakdownType", "column"); },
        onPressPaymentGroupedBar: function () { this.invoiceChartTypeModel.setProperty("/paymentBreakdownType", "bar"); },
        onPressPendingColumn: function () { this.invoiceChartTypeModel.setProperty("/pendingByCompanyType", "column"); },
        onPressPendingBar: function () { this.invoiceChartTypeModel.setProperty("/pendingByCompanyType", "bar"); },

    });
});