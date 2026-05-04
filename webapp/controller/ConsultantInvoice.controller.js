sap.ui.define(
    [
        "./BaseController", //call base controller
        "sap/ui/model/json/JSONModel",
        "sap/m/MessageToast",
        "../model/formatter",
        "sap/ui/export/Spreadsheet", // Import Spreadsheet for Excel export functionality
    ],
    function(
        BaseController, JSONModel, MessageToast, Formatter, Spreadsheet) {
        "use strict";
        return BaseController.extend("sap.kt.com.minihrsolution.controller.ConsultantInvoice", {
            Formatter: Formatter,
            onInit: function() {
                this.getRouter().getRoute("RouteConsultantInvoiceApplication").attachMatched(this._onRouteMatched, this);
            },
            _onRouteMatched: async function(oEvent) {
                try {
                    var LoginFUnction = await this.commonLoginFunction("ConsultantInvoice");
                    if (!LoginFUnction) return;

                    this.i18nModel = this.getView().getModel("i18n").getResourceBundle();

                    this.getView().getModel("LoginModel").setProperty(
                        "/HeaderName",
                        this.i18nModel.getText("consultantInvoice")
                    );

                    this._makeDatePickersReadOnly(["CI_id_DatePicker"]);

                    const from = oEvent?.getParameter("arguments")?.from;

                    this._isClearPressed = false;
                    this.bDateRangeTriggered = false;

                    //  Apply only when NOT coming from edit/detail
                    if (from !== "InvoiceEdit" && from !== "ConsultantInvoiceDetails") {

                        this.onClearAndSearch("CI_id_ConsultantInvoiceFilterBar");

                        //  Reset stored date range
                        this._selectedDateRange = null;

                        //  Set Financial Year in UI
                        const {
                            fyStart,
                            fyEnd
                        } = this._getFinancialYearRange();
                        const dateControl = this.byId("CI_id_DatePicker");

                        if (dateControl) {
                            dateControl.setDateValue(fyStart);
                            dateControl.setSecondDateValue(fyEnd);
                        }
                    }

                    //  Always call main read (it already handles fallback)
                    await this.ContractReadCall();

                    this.initializeBirthdayCarousel();

                } catch (error) {
                    this.closeBusyDialog();
                    MessageToast.show(error.message || error.responseText);
                } finally {
                    this.closeBusyDialog();
                }
            },

            ContractReadCall: async function() {
                try {
                    const oView = this.getView();
                    const userData = this.getOwnerComponent().getModel("LoginModel").getData();
                    let filterObj = {};
                    const dateControl = this.byId("CI_id_DatePicker");

                    if (userData.Role === "Contractor") {
                        oView.byId("CI_filterItem_EmployeeID").setVisible(false);
                        filterObj.EmployeeID = userData.EmployeeID;
                        oView.byId("CI_filterItem_CompanyCode").setVisible(false);
                    } else {
                        oView.byId("CI_filterItem_EmployeeID").setVisible(true);
                        if (userData.Role === "Admin" || userData.Role === "Account Manager") {
                            this.logindata();
                        } else {
                            filterObj.EmployeeID = userData.EmployeeID;
                            this.logindata();
                        }
                    }

                    let startDate, endDate;

                    let InvoicNo = this.byId("CI_id_InvoiceNo").getSelectedKey()?.split('|')[0] || "";
                    if (InvoicNo) {
                        filterObj.InvoiceNo = InvoicNo;
                    }

                    if (this._selectedDateRange?.start && this._selectedDateRange?.end) {
                        startDate = this._selectedDateRange.start;
                        endDate = this._selectedDateRange.end;

                        if (dateControl) {
                            dateControl.setDateValue(startDate);
                            dateControl.setSecondDateValue(endDate);
                        }
                    } else if (dateControl?.getDateValue() && dateControl?.getSecondDateValue()) {
                        startDate = dateControl.getDateValue();
                        endDate = dateControl.getSecondDateValue();
                    } else {
                        if (this._isClearPressed) {
                            startDate = null;
                            endDate = null;

                            if (dateControl) {
                                dateControl.setDateValue(null);
                                dateControl.setSecondDateValue(null);
                            }

                        }

                    }

                    const formatDate = (date) => date.toISOString().split("T")[0];

                    if (startDate && endDate) {
                        filterObj.InvoiceStartDate = formatDate(startDate);
                        filterObj.InvoiceEndDate = formatDate(endDate);
                    }

                    this.getBusyDialog();

                    const oData = await this.ajaxReadWithJQuery("ConsultantInvoice", filterObj);

                    this.getView().setModel(new JSONModel(oData.data), "ConsultantModel");
                    if (oData.data && InvoicNo === "") {
                        this.getView().setModel(new JSONModel(oData.data), "InvoiceModel");
                    }


                    const oTable = this.getView().byId("CI_id_ConsultantInvoiceTable");
                    const oSorter = [];

                    if (userData.Role === "Admin" || userData.Role === "Account Manager") {
                        oSorter.push(new sap.ui.model.Sorter("EmployeeID", false, true));
                    } else if (userData.Role === "Contractor") {
                        oSorter.push(new sap.ui.model.Sorter("InvoiceDate", false, true));
                    }

                    oTable.bindItems({
                        path: "ConsultantModel>/",
                        sorter: oSorter,
                        template: oTable.getBindingInfo("items").template,
                        groupHeaderFactory: this._createGroupHeader.bind(this)
                    });

                    this.closeBusyDialog();
                } catch (error) {
                    this.closeBusyDialog();
                    MessageToast.show(error.message || error.responseText);
                }
            },

            _createGroupHeader: function(oGroup) {
                let sKey = oGroup.key;
                const userData = this.getView().getModel("LoginModel").getData();

                // Format InvoiceDate group headers if grouping by InvoiceDate
                if (userData.Role === "Contractor" && oGroup) {
                    sKey = this.Formatter.formatDate(sKey);
                }

                const oHeader = new sap.m.GroupHeaderListItem({
                    title: sKey,
                    upperCase: false
                });

                // Apply custom background and text color
                oHeader.addEventDelegate({
                    onAfterRendering: function() {
                        this.$().css({
                            "background-color": "rgb(214 230 235)",
                            "color": "#000000"
                        });
                    }
                }, oHeader);

                return oHeader;
            },

            logindata: function() {
                try {
                    this.ajaxReadWithJQuery("AllLoginDetails", "EmpModel").then((data) => {
                        if (data.success) {
                            const filteredData = data.data.filter(emp => emp.Role !== 'Trainee');
                            var oModel = new JSONModel();
                            oModel.setData(filteredData);
                            this.getView().setModel(oModel, "EmpModel");
                        }
                    }).catch((error) => {
                        MessageToast.show(error.message || error.responseText);
                    });
                } catch (error) {
                    MessageToast.show(error.message || error.responseText);
                }
            },

            CI_onPressAddInvoice: function() {
                this.getRouter().navTo("RouteNavConsultantInvoiceApplication", {
                    sPath: "X",
                    oPath: "Y",
                });
            },

            CI_onPressInvoice: function(oEvent) {
                var oBindingContext = oEvent.getSource().getBindingContext("ConsultantModel");
                var oInvoiceNo = oBindingContext.getProperty("InvoiceNo");
                var oEmployeeID = oBindingContext.getProperty("EmployeeID");
                this.getRouter().navTo("RouteNavConsultantInvoiceApplication", {
                    sPath: encodeURIComponent(oInvoiceNo),
                    oPath: encodeURIComponent(oEmployeeID)
                });
            },

            onPressback: function() {
                this.getRouter().navTo("RouteTilePage");
            },

            onLogout: function() {
                this.getRouter().navTo("RouteLoginPage");
            },

            CI_onClearFilters: function() {
                const oFilterBar = this.getView().byId("CI_id_ConsultantInvoiceFilterBar");
                oFilterBar.getFilterGroupItems().forEach((oItem) => {
                    const oControl = oItem.getControl();
                    if (oControl) {
                        if (oControl.isA("sap.m.ComboBox")) {
                            oControl.setSelectedKey("");
                        } else if (oControl.setValue) {
                            oControl.setValue("");
                        }
                    }
                });
                this._isClearPressed = true;
                this.bDateRangeTriggered = true;
            },

            CI_OnSearch: async function() {
                try {

                    const dateControl = this.byId("CI_id_DatePicker");

                    if (dateControl && dateControl.getDateValue() && dateControl.getSecondDateValue()) {
                        this._selectedDateRange = {
                            start: dateControl.getDateValue(),
                            end: dateControl.getSecondDateValue()
                        };
                    }

                    this.ContractReadCall();
                    const oFilterBar = this.byId("CI_id_ConsultantInvoiceFilterBar");
                    const aFilterItems = oFilterBar.getFilterGroupItems();
                    const params = {};
                    const userData = this.getOwnerComponent().getModel("LoginModel").getData();

                    // Financial year logic
                    const {
                        fyStart,
                        fyEnd,
                        financialYearLabel
                    } = this._getFinancialYearRange();
                    const formatDate = (date) => date.toISOString().split("T")[0];

                    let invoiceDateProvided = false;
                    aFilterItems.forEach((oItem) => {
                        const oControl = oItem.getControl();
                        const sParamKey = oItem.getName();

                        if (oControl) {
                            if (oControl.isA("sap.m.ComboBox")) {
                                const selectedKey = oControl.getSelectedKey();
                                const inputValue = oControl.getValue();

                                if (sParamKey === "InvoiceNo") {
                                    if (selectedKey) {
                                        const [invoiceNo, employeeId] = selectedKey.split("|");
                                        if (invoiceNo) params["InvoiceNo"] = invoiceNo;
                                        if (employeeId) params["EmployeeID"] = employeeId;
                                    } else if (inputValue) {
                                        params["InvoiceNo"] = inputValue;
                                    }
                                } else {
                                    if (selectedKey) {
                                        params[sParamKey] = selectedKey;
                                    } else if (inputValue) {
                                        params[sParamKey] = inputValue;
                                    }
                                }
                            } else if (oControl.isA("sap.m.DateRangeSelection")) {
                                const value = oControl.getValue();
                                if (value && value.includes("-")) {
                                    const [start, end] = value.split("-").map(date =>
                                        date.trim().split("/").reverse().join("-")
                                    );
                                    params.InvoiceStartDate = start;
                                    params.InvoiceEndDate = end;
                                    invoiceDateProvided = true; // Set dateRange for ComboBox filtering
                                    this.dateRangeStart = start;
                                    this.dateRangeEnd = end;
                                    this.bDateRangeTriggered = true;
                                }
                            } else if (oControl.getValue && oControl.getValue()) {
                                params[sParamKey] = oControl.getValue();
                            }
                        }
                    });

                    // Role-based filter
                    if (userData.Role === "Contractor") {
                        params.EmployeeID = userData.EmployeeID;
                    }

                    // Handle Clear Press
                    if (this._isClearPressed) {
                        delete params.InvoiceStartDate;
                        delete params.InvoiceEndDate;
                        delete params.FinancialYear;
                        this._isClearPressed = false;
                        this.dateRangeStart = null;
                        this.dateRangeEnd = null;
                        this.bDateRangeTriggered = false;
                    } else {
                        const startDate = new Date(params.InvoiceStartDate); // If user selected full financial year range manually
                        const endDate = new Date(params.InvoiceEndDate);
                        if (startDate.getTime() === fyStart.getTime() && endDate.getTime() === fyEnd.getTime()) {
                            params.FinancialYear = financialYearLabel;
                            this.bDateRangeTriggered = false; // Reset since filtering not needed
                        }
                    }
                    this.getBusyDialog();
                    const oData = await this.ajaxReadWithJQuery("ConsultantInvoice", params);
                    if (oData && Array.isArray(oData.data)) {
                        const oModel = new JSONModel(oData.data);
                        this.getView().setModel(oModel, "ConsultantModel");
                        let invoiceData = oData.data;
                        let shouldBindInvoiceModel = true;
                        if (this.bDateRangeTriggered && this.dateRangeStart && this.dateRangeEnd) {
                            const start = new Date(this.dateRangeStart);
                            const end = new Date(this.dateRangeEnd);
                            const startDate = new Date(params.InvoiceStartDate);
                            const endDate = new Date(params.InvoiceEndDate);
                            if (startDate.getTime() === fyStart.getTime() && endDate.getTime() === fyEnd.getTime()) {
                                params.FinancialYear = financialYearLabel;
                                shouldBindInvoiceModel = false;
                            } else {
                                shouldBindInvoiceModel = false;
                                invoiceData = oData.data.filter(item => {
                                    const itemDate = new Date(item.InvoiceDate);
                                    return itemDate >= start && itemDate <= end;
                                });
                            }
                            this.bDateRangeTriggered = false;
                        }
                        // if (shouldBindInvoiceModel) {
                        //     const oInvoiceModel = new JSONModel(invoiceData);
                        //     this.getView().setModel(oInvoiceModel, "InvoiceModel");
                        //     oInvoiceModel.refresh(true);
                        // }
                    }
                    this.closeBusyDialog();
                } catch (error) {
                    sap.m.MessageToast.show(error.message || error.responseText || this.i18nModel.getText("technicalError"));
                } finally {
                    this.closeBusyDialog();
                }
            },

            // Helper function to get financial year range
            _getFinancialYearRange: function() {
                const today = new Date();
                const currentYear = today.getFullYear();
                const currentMonth = today.getMonth(); // 0 = Jan, 3 = April
                let fyStart, fyEnd, financialYearLabel;
                if (currentMonth >= 3) { // April or later
                    fyStart = new Date(currentYear, 3, 1); // April 1st
                    fyEnd = new Date(currentYear + 1, 2, 31); // March 31st next year
                    financialYearLabel = `${currentYear}-${currentYear + 1}`;
                } else {
                    fyStart = new Date(currentYear - 1, 3, 1); // April 1st last year
                    fyEnd = new Date(currentYear, 2, 31); // March 31st this year
                    financialYearLabel = `${currentYear - 1}-${currentYear}`;
                }
                return {
                    fyStart,
                    fyEnd,
                    financialYearLabel
                };
            },

            onDateRangeChange: function(oEvent) {
                try {
                    const oDateRange = oEvent.getSource();
                    const value = oDateRange.getValue();
                    if (value && value.includes("-")) {
                        const [start, end] = value.split("-").map(date =>
                            date.trim().split("/").reverse().join("-")
                        );
                        this.dateRangeStart = start;
                        this.dateRangeEnd = end;
                        this.bDateRangeTriggered = true;
                        const oComboBox = this.byId("CI_id_InvoiceNo");
                        if (oComboBox) {
                            oComboBox.setSelectedKey("");
                            oComboBox.setValue("");
                        }
                    }
                } catch (error) {
                    MessageToast.show(error.message || error.responseText);
                }
            },

            _filterInvoiceModelByDateRange: function(startDate, endDate) {
                const oConsultantModel = this.getView().getModel("ConsultantModel");
                const oInvoiceModel = this.getView().getModel("InvoiceModel");
                if (!oConsultantModel || !oInvoiceModel) return;
                const aAllData = oConsultantModel.getData(); // Get all data from ConsultantModel
                if (!Array.isArray(aAllData)) return;
                const aFilteredData = aAllData.filter(item => { // Filter data by date range
                    const itemDate = new Date(item.InvoiceDate);
                    const start = new Date(startDate);
                    const end = new Date(endDate);
                    return itemDate >= start && itemDate <= end;
                });
                oInvoiceModel.setData(aFilteredData); // Update InvoiceModel with filtered data
                oInvoiceModel.refresh(true);
            },

            CI_onInvoiceDownloadPress: function() {
                const oTable = this.getView().byId("CI_id_ConsultantInvoiceTable");
                const oModelData = oTable.getModel("ConsultantModel").getData().map(item => {

                    return {
                        ...item,
                        InvoiceDate: Formatter.formatDate(item.InvoiceDate),
                        PayBy: Formatter.formatDate(item.PayBy)

                    };
                });

                if (!oModelData || oModelData.length === 0) {
                    MessageToast.show(this.getView().getModel("i18n").getResourceBundle().getText("noData"));
                    return;
                }
                const that = this;
                 const aCols = [
                    { label: that.i18nModel.getText("consultantName"), property: "ConsultantName", type: "string" },
                    { label: that.i18nModel.getText("invoiceNo"), property: "InvoiceNo", type: "string" },
                    { label: that.i18nModel.getText("invoiceTo"), property: "InvoiceTo", type: "string" },
                    { label: that.i18nModel.getText("invoiceTo"), property: "InvoiceDate", type: "string" },
                    { label: that.i18nModel.getText("payBy"), property: "PayBy", type: "string" },
                    { label: that.i18nModel.getText("GSTNO"), property: "GSTNO", type: "string" },
                    { label: that.i18nModel.getText("totalAmount"), property: "TotalSum", type: "string" },
                    { label: that.i18nModel.getText("currency"), property: "Currency", type: "string" }
                ];

                const oSettings = {
                    workbook: {
                        columns: aCols,
                        context: {
                            sheetName: that.i18nModel.getText("contractorDetails")
                        }
                    },
                    dataSource: oModelData,
                    fileName: "Contractor_Details.xlsx"
                };

                const oSheet = new Spreadsheet(oSettings);
                oSheet.build().then(function() {
                    MessageToast.show(that.i18nModel.getText("exportSuccessful"));
                }).finally(function() {
                    oSheet.destroy();
                });
            }
        })
    }
)