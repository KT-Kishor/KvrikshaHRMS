sap.ui.define(
    [
        "./BaseController", //import base controller
        "../model/formatter",
        "sap/ui/model/json/JSONModel",
        'sap/ui/export/Spreadsheet',
    ],
    function(BaseController, Formatter, JSONModel, Spreadsheet) {
        "use strict";
        return BaseController.extend("sap.kt.com.minihrsolution.controller.HrQuotation", {
            Formatter: Formatter,
            onInit: function() {
                this.getRouter().getRoute("RouteHrQuotation").attachMatched(this._onRouteMatched, this);
            },

 _onRouteMatched: async function (oEvent) {
    try {
        var LoginFunction = await this.commonLoginFunction("HrQuotation");
        if (!LoginFunction) return;

        var FileName = oEvent.getParameter("arguments").from;
        this.getBusyDialog();

        this.i18nModel = this.getView().getModel("i18n").getResourceBundle();
        this.getView().getModel("LoginModel").setProperty("/HeaderName", "Manage Quotation");

        if (!this.getView().getModel("filters")) {
            this.getView().setModel(new JSONModel({
                QuotationNo: "",
                CustomerName: "",
                CompanyCode: "",
                DateFrom: null,
                DateTo: null
            }), "filters");
        }

        // Fresh tile entry
        if (FileName === "Tilepage") {
            this._isClearPressed = false;

            const oQuotationNo = this.byId("HQ_id_quotationNo");
            const oCustomerName = this.byId("HQ_id_CustomerName");
            const oCompanyCode = this.byId("HQ_id_CompanyCodeComboBox");
            const oDateControl = this.byId("HQ_id_Quotaiondate");

            if (oQuotationNo) {
                oQuotationNo.setSelectedKey("");
                oQuotationNo.setValue("");
            }

            if (oCustomerName) {
                oCustomerName.setSelectedKey("");
                oCustomerName.setValue("");
            }

            if (oCompanyCode) {
                oCompanyCode.setSelectedKey("");
                oCompanyCode.setValue("");
            }

            if (oDateControl) {
                oDateControl.setDateValue(null);
                oDateControl.setSecondDateValue(null);
                oDateControl.setValue("");
            }

                         
            const fyDates = this._getFinancialYearDates();
            const sDateFrom = this._formatDateForBackend(fyDates.start);
            const sDateTo = this._formatDateForBackend(fyDates.end);

            if (oDateControl) {
                oDateControl.setDateValue(fyDates.start);
                oDateControl.setSecondDateValue(fyDates.end);
            }

            this.getView().getModel("filters").setData({
                QuotationNo: "",
                CustomerName: "",
                CompanyCode: "",
                DateFrom: sDateFrom,
                DateTo: sDateTo
            });
        }

        await this.HQ_onSearch();
        this.initializeBirthdayCarousel();

    } catch (error) {
        this.closeBusyDialog();
        MessageToast.show(error.message || error.responseText);
    } finally {
        this.closeBusyDialog();
    }
},

            onTableUpdateFinished: function(oEvent) {
                // Update the count in the header when table updates
                var oTable = this.byId("HQ_id_QuotationItemTable");
                var oTitle = oTable.getHeaderToolbar().getContent()[0];
                var iLength = oTable.getBinding("items").getLength();
                oTitle.setText(this.getView().getModel("i18n").getResourceBundle().getText("quotaionDetails") + " (" + iLength + ")");
            },

            _getFinancialYearDates: function() {
                var today = new Date();
                var currentMonth = today.getMonth() + 1;
                var currentYear = today.getFullYear();

                //  financial year runs from April to March
                var fyStart, fyEnd;
                if (currentMonth >= 4) {
                    fyStart = new Date(currentYear, 3, 1); // April 1 (month is 0-based)
                    fyEnd = new Date(currentYear + 1, 2, 31); // March 31 of next year
                } else {
                    // Current financial year is previous year April to current year March
                    fyStart = new Date(currentYear - 1, 3, 1);
                    fyEnd = new Date(currentYear, 2, 31);
                }
                return {
                    start: fyStart,
                    end: fyEnd
                };
            },
    

            // Helper function to format date for backend
            _formatDateForBackend: function(date) {
                if (!date) return null;
                var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
                    pattern: "yyyy-MM-dd"
                });
                return oDateFormat.format(date);
            },

            HQ_onSearch: async function() {
                try {
                    this.getBusyDialog();
                    const aFilterItems = this.byId("HQ_id_QuotationFilterBar").getFilterGroupItems();
                    var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
                        pattern: "yyyy-MM-dd"
                    });
                    const params = {};
                    let dateProvided = false;

                    // Read filters
                    aFilterItems.forEach((oItem) => {
                        const oControl = oItem.getControl();
                        const sName = oItem.getName();

                        if (!oControl) return;

                        // Date range
                        if (sName === "Date" && oControl.isA("sap.m.DateRangeSelection")) {
                            const oStartDate = oControl.getDateValue();
                            const oEndDate = oControl.getSecondDateValue();
                            if (oStartDate && oEndDate) {
                                params.DateFrom = oDateFormat.format(oStartDate);
                                params.DateTo = oDateFormat.format(oEndDate);
                                dateProvided = true;
                            }
                            return;
                        }

                        // ComboBox (supports manual entry)
                        if (oControl.isA("sap.m.ComboBox")) {
                            const selectedKey = oControl.getSelectedKey();
                            if (selectedKey) {
                                params[sName] = selectedKey;
                            } else {
                                const typedValue = oControl.getValue().trim();
                                if (typedValue) {
                                    params[sName] = typedValue;
                                }
                            }
                            return;
                        }

                        // Generic value-based controls
                        if (typeof oControl.getValue === "function") {
                            const sValue = oControl.getValue().trim();
                            if (sValue) {
                                params[sName] = sValue;
                            }
                        }
                    });

                    // Financial Year fallback
                    // const fy = this._getDates();
                    // const financialYearLabel = fy.start.getFullYear() + "-" + fy.end.getFullYear();

                    if (this._isClearPressed) {
                        // Skip filters
                        delete params.DateFrom;
                        delete params.DateTo;
                        delete params.FinancialYear;
                    } else {
                        // Check if selected dates match FY
                        const selectedStart = new Date(params["DateFrom"]);
                        const selectedEnd = new Date(params["DateTo"]);
                      
                    }

                    // Set filters to model
                 this.getView().getModel("filters")?.setData(params);

                    // Fetch all data
                    await this._fetchCommonData("Quotation", "AllQuotationsModel");

                    // Fetch filtered view data
                   await this._fetchCommonData("Quotation", "CompanyQuotationModel", {
                        QuotationNo: params.QuotationNo || null,
                        CustomerName: params.CustomerName || null,
                        DateFrom: params.DateFrom,
                        DateTo: params.DateTo,
                        CompanyCode: params.CompanyCode || null,
                    });

               
                    

                    // Filter table
                   const oTable = this.byId("HQ_id_QuotationItemTable");

this.onTableUpdateFinished();

await new Promise(resolve => {
    oTable.attachEventOnce("updateFinished", () => {
        setTimeout(() => {
            this._refreshFilterBarDropdowns();
            resolve();
        }, 200);
    });
});

                } catch (error) {
                    console.error("Search error:", error);
                    MessageToast.show(this.i18nModel.getText("commonErrorMessage") || "Error during search.");
                } finally {
                    this.closeBusyDialog();
                }
            },

            _refreshFilterBarDropdowns: function() {
                const oAllQuotationsModel = this.getView().getModel("AllQuotationsModel");
                if (!oAllQuotationsModel) return;

                const aAllData = oAllQuotationsModel.getData() || [];
                let aFilteredData = [];

                if (this._isClearPressed) {
                    aFilteredData = aAllData; // No filtering — use all data
                    this._isClearPressed = false;
                } else {
                    let oStartDate, oEndDate; // Filter by selected date range or fallback to FY
                    const oDateRange = this.byId("HQ_id_Quotaiondate");

                        oStartDate = oDateRange.getDateValue();
                        oEndDate = oDateRange.getSecondDateValue();
                  
                        if(oStartDate===null){
                             aFilteredData = aAllData
                        }else{

                    aFilteredData = aAllData.filter(oItem => {
                        const sItemDate = oItem.Date;
                        if (!sItemDate) return false;

                        const oItemDate = new Date(sItemDate);
                        return oItemDate >= oStartDate && oItemDate <= oEndDate;
                    });
                }
                }

                // Build unique dropdown lists
                const aUniqueQuotations = [];
                const aUniqueCustomers = [];
                const mSeenQuotations = {};
                const mSeenCustomers = {};

                aFilteredData.forEach(oItem => {
                    if (oItem?.QuotationNo && !mSeenQuotations[oItem.QuotationNo]) {
                        aUniqueQuotations.push({
                            QuotationNo: oItem.QuotationNo,
                            CompanyName: oItem.CompanyName || ""
                        });
                        mSeenQuotations[oItem.QuotationNo] = true;
                    }

                    if (oItem?.CustomerName && !mSeenCustomers[oItem.CustomerName]) {
                        aUniqueCustomers.push({
                            CustomerName: oItem.CustomerName,
                            QuotationNo: oItem.QuotationNo || ""
                        });
                        mSeenCustomers[oItem.CustomerName] = true;
                    }
                });

                // Set models and refresh dropdowns
                this.getView().setModel(new sap.ui.model.json.JSONModel(aUniqueQuotations), "FilteredQuotations");
                this.getView().setModel(new sap.ui.model.json.JSONModel(aUniqueCustomers), "FilteredCustomers");

                this.byId("HQ_id_quotationNo")?.getBinding("items")?.refresh(true);
                this.byId("HQ_id_CustomerName")?.getBinding("items")?.refresh(true);
            },

            HQ_onClearFilters: function() {
                this.byId("HQ_id_quotationNo").setSelectedKey("");
                this.byId("HQ_id_CustomerName").setSelectedKey("");
                this.byId("HQ_id_Quotaiondate").setValue("");
                this.byId("HQ_id_CompanyCodeComboBox").setSelectedKey("");
                this._isClearPressed = true;
            },

            onDateRangeChange: function(oEvent) {
                var oDateRange = oEvent.getSource();
                var dateFrom = oDateRange.getDateValue();
                var dateTo = oDateRange.getSecondDateValue();
                var oFiltersModel = this.getView().getModel("filters");
                if (oFiltersModel) {
                    oFiltersModel.setProperty("/DateFrom", dateFrom ? this._formatDateForBackend(dateFrom) : null);
                    oFiltersModel.setProperty("/DateTo", dateTo ? this._formatDateForBackend(dateTo) : null);
                }
            },

            HQ_onPressAddQuotation: function() {
                this.getRouter().navTo("RouteHrQuotationDetails", {
                    sQuotationNo: "new"
                })
            },

            onPressback: function() {
                this.getRouter().navTo("RouteTilePage"); // Function to navigate back to the TileAdminView route
            },

            onLogout: function() {
                this.CommonLogoutFunction();
            },

            HQ_onPressBack: function() {
                this.navigateToRouteView1();
            },

            HQ_onPressQuotation: function(oEvent) {
                var oContext = oEvent.getSource().getBindingContext("CompanyQuotationModel");
                var oData = oContext.getObject(); // get full object
                var sQuotationNo = oData.QuotationNo; // extract actual QuotationNo

                this.getRouter().navTo("RouteHrQuotationDetails", {
                    sQuotationNo: encodeURIComponent(sQuotationNo)
                });
            },

            HQ_DownloadTableData: function() {
                var table = this.byId("HQ_id_QuotationItemTable");
                var oBinding = table.getBinding("items");
                var aFilteredData = oBinding.getCurrentContexts().map(function(oContext) {
                    return oContext.getObject();
                });

                const aFormattedData = aFilteredData.map(item => {
                    return {
                        ...item,
                        Date: Formatter.formatDate(item.Date),
                    };
                });
                const aCols = [{
                        label: this.i18nModel.getText("quotationNo"),
                        property: "QuotationNo",
                        type: "string"
                    },
                    {
                        label: this.i18nModel.getText("quotaiodate"),
                        property: "Date",
                        type: "string"
                    },
                    {
                        label: this.i18nModel.getText("customerName"),
                        property: "CustomerName",
                        type: "string"
                    },
                    {
                        label: this.i18nModel.getText("customerGSTNO"),
                        property: "CustomerGSTNO",
                        type: "string"
                    },
                    {
                        label: this.i18nModel.getText("email"),
                        property: "CustomerEmailID",
                        type: "string"
                    },
                    {
                        label: this.i18nModel.getText("mobileNo"),
                        property: "CustomerMobileNo",
                        type: "string "
                    },
                    {
                        label: this.i18nModel.getText("pdfTotal"),
                        property: "TotalSum",
                        type: "string"
                    },
                ];
                const oSettings = {
                    workbook: {
                        columns: aCols,
                        context: {
                            sheetName: this.i18nModel.getText("quotationdetails")
                        }
                    },
                    dataSource: aFormattedData,
                    fileName: "Quatation.xlsx"
                };
                const oSheet = new Spreadsheet(oSettings);
                oSheet.build().then(function() {
                        MessageToast.show(this.i18nModel.getText("downloadsuccessfully"));
                    }.bind(this))
                    .finally(function() {
                        oSheet.destroy();
                    });

            },

            // Delete the Quotation and Quotation Item
            HQD_onPressDeleteQuotation: async function(oEvent) {
                var oTable = this.byId("HQ_id_QuotationItemTable");
                var oSelectedItem = oTable.getSelectedItem();
                if (!oSelectedItem) {
                    sap.m.MessageToast.show(this.i18nModel.getText("selectQuotationToDelete"));
                    return;
                }
                var sQuotationNo = oSelectedItem.getBindingContext("CompanyQuotationModel").getProperty("QuotationNo");
                var that = this;
                this.showConfirmationDialog(
                    this.i18nModel.getText("msgBoxConfirm"),
                    this.i18nModel.getText("commonMesBoxConfirmDeleteQuotation"),
                    async function() {
                            that.getBusyDialog();
                            try {
                                await that.ajaxDeleteWithJQuery("/Quotation", {
                                    filters: {
                                        QuotationNo: sQuotationNo
                                    }
                                });
                                sap.m.MessageToast.show(that.i18nModel.getText("QuotationDeleteMess"));
                                that.HQ_onSearch();
                                oTable.removeSelections(true);
                            } catch (error) {
                                sap.m.MessageToast.show(error.responseText || "Error deleting Quotation.");
                            } finally {
                                that.closeBusyDialog();
                            }
                        },
                        function() {
                            that.closeBusyDialog();
                            oTable.removeSelections(true);
                        })
            },
        });
    });