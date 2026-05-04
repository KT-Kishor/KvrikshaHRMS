sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "../utils/validation",
    "../model/formatter",
    "sap/m/MessageToast",
    "sap/ui/export/Spreadsheet", // Import Spreadsheet for Excel export functionality
], function(
    BaseController, JSONModel, utils, formatter, MessageToast, Spreadsheet) {
    "use strict";
    return BaseController.extend("sap.kt.com.minihrsolution.controller.PurchaseOrder", {
        formatter: formatter,
        onInit: function() {
            this._isInitialPOLoad = true;
            this.getRouter().getRoute("PurchaseOrder").attachPatternMatched(this._onRouteMatched, this);
        },
        _onRouteMatched: async function(oEvent) {
            this.i18nModel = this.getView().getModel("i18n").getResourceBundle();

            const LoginFunction = await this.commonLoginFunction("PurchaseOrder");
            if (!LoginFunction) return;

            try {
                this.getBusyDialog();
                this._isClearPressed = false;

                await this._fetchCommonData("ManageCustomer", "ManageCustomerModel");

                const from = oEvent.getParameter("arguments")?.from;

                if (from !== "Purchasedetails") {

                    this.onClearAndSearch("PO_id_FilterbarEmployee");

                    const currentYear = new Date().getFullYear();
                    let fyStart, fyEnd;

                    if (new Date().getMonth() >= 3) {
                        fyStart = new Date(currentYear, 3, 1);
                        fyEnd = new Date(currentYear + 1, 2, 31);
                    } else {
                        fyStart = new Date(currentYear - 1, 3, 1);
                        fyEnd = new Date(currentYear, 2, 31);
                    }

                    const oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
                        pattern: "yyyy-MM-dd"
                    });

                    const filters = {
                        StartDate: oDateFormat.format(fyStart),
                        EndDate: oDateFormat.format(fyEnd)
                    };

                    // Set UI Date Range
                    const dateRangeControl = this.byId("PO_idECreationDatePicker");
                    if (dateRangeControl) {
                        dateRangeControl.setDateValue(fyStart);
                        dateRangeControl.setSecondDateValue(fyEnd);
                    }

                    // Fetch filter model
                    await this._fetchCommonData("PurchaseOrder", "POModelfilter", filters);

                    // Fetch main data
                    const oData = await this.ajaxReadWithJQuery("PurchaseOrder", filters);

                    const aData = Array.isArray(oData.data) ? oData.data : [oData.data];

                    this.getOwnerComponent().setModel(
                        new sap.ui.model.json.JSONModel(aData),
                        "POModel"
                    );

                } else {
                    await this.PO_onSearch();
                }

                // Initialize empty form model
                const model = new sap.ui.model.json.JSONModel({
                    CustomerName: "",
                    Type: "",
                    Address: "",
                    StartDate: "",
                    EndDate: "",
                    PAN: "",
                    CurrentDate: "",
                    Description: "",
                    Unit: "",
                    Amount: "",
                    Currency: "",
                    Notes: "",
                    PurchaseOrders: []
                });

                this.getView().setModel(model, "PurchaseOrderModel");

                this.getView().getModel("LoginModel").setProperty(
                    "/HeaderName",
                    "Purchase Order"
                );

                this.initializeBirthdayCarousel();

            } catch (error) {
                sap.m.MessageToast.show(error.message || error.responseText);
            } finally {
                this.closeBusyDialog();
            }
        },
        onPressback: function() {
            this.getRouter().navTo("RouteTilePage");
        },
        onLogout: function() {
            this.CommonLogoutFunction()
        },
        PO_onCreatePurchaseOrder: function() {
            this.getRouter().navTo("PurchaseOrderObject", {
                sPath: "PurchaseOrder"
            });
        },
        PO_onCloseFrag: function() {
            this.PO_oDialog.close();
            var oModel = this.getView().getModel("PurchaseOrderModel");
            oModel.setProperty("/PurchaseOrders", []);
        },
        PO_onAmountInputChange: function(oEvent) {
            utils._LCvalidateAmount(oEvent);
        },
        onDescriptionInputLiveChange: function(oEvent) {
            utils._LCvalidateMandatoryField(oEvent)
        },
        FPO_onDateChange: function(oEvent) {
            utils._LCvalidateDate(oEvent)
        },
        PO_ReadCall: async function() {
            this.getBusyDialog()
            await this.ajaxReadWithJQuery("PurchaseOrder").then((oData) => {
                var PoData = Array.isArray(oData.data) ? oData.data : [oData.data];
                this.getOwnerComponent().setModel(new JSONModel(PoData), "POModel");
                this.closeBusyDialog()
            });
        },
        PO_onDeleteButtonPress: function() {
            var Table = this.getView().byId("idPOTable");
            var selectedItem = Table.getSelectedItem();
            if (!selectedItem) {
                MessageToast.show(this.i18nModel.getText("selectPurchaseOrder"));
                return;
            }
            var PoNumber = selectedItem.getBindingContext("POModel").getProperty("PoNumber");
            this.showConfirmationDialog(
                "Delete Confirmation",
                "Are you sure you want to delete this Purchase Order?",
                () => {
                    this.getBusyDialog()
                    this.ajaxDeleteWithJQuery("PurchaseOrder", {
                        filters: {
                            PoNumber: PoNumber
                        }
                    }).then(() => {
                        MessageToast.show(this.i18nModel.getText("purchaseOrderDeleted"));
                        this.PO_ReadCall();

                    });
                },
                function() {
                    Table.removeSelections()
                }
            );

        },
        onColumnListItemPress: function(oEvent) {
            var PoNumber = oEvent.getSource().getBindingContext("POModel").getObject().PoNumber;
            var onav = this.getOwnerComponent().getRouter()
            onav.navTo("PurchaseOrderObject", {
                sPath: PoNumber
            })
        },
        PO_onSearch: async function() {
            try {
                this.getBusyDialog();
                const filters = {};
                let dateProvided = false;
                // PoNumber from Select/Input
                const PoControl = this.byId("PO_id_PoNumber");
                const Po = PoControl.getSelectedKey() || PoControl.getValue();
                if (Po) {
                    filters.PoNumber = Po;
                }
                var CustName1 = this.getView().byId("PO_id_CustomerName")
                var CustName = CustName1.getSelectedKey() ? CustName1.getSelectedKey() : CustName1.getValue()
                if (CustName) {
                    filters.CustomerName = CustName;
                }

                var Cmpname1 = this.getView().byId("PO_id_CompanyName")
                var Cmpname = Cmpname1.getSelectedKey() ? Cmpname1.getSelectedKey() : Cmpname1.getValue()
                if (Cmpname) {
                    filters.CompanyCode = Cmpname;
                }
                // Date Picker (range)
                const oDateRange = this.byId("PO_idECreationDatePicker");
                const oStartDate = oDateRange.getDateValue();
                const oEndDate = oDateRange.getSecondDateValue();
                const odateFormat = sap.ui.core.format.DateFormat.getDateInstance({
                    pattern: "yyyy-MM-dd"
                });
                // Financial Year Calculation
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
                // Determine which date to apply
                if (this._isClearPressed) {
                    delete filters.StartDate;
                    delete filters.EndDate;
                    delete filters.FinancialYear;
                    this._isClearPressed = false; // reset
                } else if (oStartDate && oEndDate) {
                    filters.StartDate = odateFormat.format(oStartDate);
                    filters.EndDate = odateFormat.format(oEndDate);
                    dateProvided = true;

                }
                this._fetchCommonData("PurchaseOrder", "POModelfilter", {
                    StartDate: filters.StartDate,
                    EndDate: filters.EndDate
                });
                // Fetch filtered data
                await this.ajaxReadWithJQuery("PurchaseOrder", filters).then((oData) => {
                    var oFCIAerData1 = Array.isArray(oData.data) ? oData.data : [oData.data]
                    this.getOwnerComponent().setModel(new JSONModel(oFCIAerData1), "POModel");

                })

                this.closeBusyDialog();
            } catch (error) {
                this.closeBusyDialog();
                MessageToast.show("Technical error occurred");
            }
        },
        PO_onPressClear: function() {
            this.getView().byId("PO_id_CustomerName").setSelectedKey("");
            this.getView().byId("PO_id_PoNumber").setSelectedKey("");
            this.byId("PO_idECreationDatePicker").setValue("");
            this.byId("PO_id_CompanyName").setSelectedKey("");

            this._isClearPressed = true;
        },
        onClearNotesPress: function() {
            this.getView().getModel("PurchaseOrderModel").setProperty("/Notes", "")
        },
        PO_onDownloadButtonPress: function() {
            const oTable = this.getView().byId("idPOTable");
            const oModelData = oTable.getModel("POModel").getData().map(item => {
                return {
                    ...item,
                    StartDate: formatter.formatDate(item.StartDate),
                    EndDate: formatter.formatDate(item.EndDate),
                    CurrentDate: formatter.formatDate(item.CurrentDate),
                };
            });
            if (!oModelData || oModelData.length === 0) {
                MessageToast.show(this.getView().getModel("i18n").getResourceBundle().getText("noData"));
                return;
            }
            const that = this;
            const aCols = [{
                    label: that.i18nModel.getText("ponumber"),
                    property: "PoNumber",
                    type: "number"
                },
                {
                    label: that.i18nModel.getText("customerName"),
                    property: "CustomerName",
                    type: "string"
                },
                {
                    label: that.i18nModel.getText("customerAddress"),
                    property: "Address",
                    type: "string"
                },
                {
                    label: that.i18nModel.getText("type"),
                    property: "Type",
                    type: "string"
                },
                {
                    label: that.i18nModel.getText("pan"),
                    property: "PAN",
                    type: "string"
                },
                {
                    label: that.i18nModel.getText("sdate"),
                    property: "StartDate",
                    type: "string"
                },
                {
                    label: that.i18nModel.getText("edate"),
                    property: "EndDate",
                    type: "string"
                },
                {
                    label: that.i18nModel.getText("podate"),
                    property: "CurrentDate",
                    type: "string"
                },
            ];
            const oSettings = {
                workbook: {
                    columns: aCols,
                    context: {
                        sheetName: that.i18nModel.getText("purchaseOrder")
                    }
                },
                dataSource: oModelData,
                fileName: "Purchase_Order.xlsx"
            };

            const oSheet = new Spreadsheet(oSettings);
            oSheet.build().then(function() {
                MessageToast.show(that.i18nModel.getText("exportSuccessful"));
            }).finally(function() {
                oSheet.destroy();
            });
        }
    });
});