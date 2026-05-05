sap.ui.define([
    "./BaseController",
    "../model/formatter",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "../utils/validation",
    "sap/ui/export/Spreadsheet"
], function(BaseController, Formatter, JSONModel, MessageToast, utils, Spreadsheet) {
    "use strict";
    return BaseController.extend("sap.kt.com.minihrsolution.controller.PayslipDeduction", {
        Formatter: Formatter,
        onInit: function() {
            this.getRouter().getRoute("RoutePayslipDeduction").attachMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: async function(oEvent) {
            var LoginFUnction = await this.commonLoginFunction("PaySlip");
            if (!LoginFUnction) return;
            this.onClearAndSearch("PD_id_Filterbar"); // Clear and search function
            this.getView().getModel("CurrencyModel").getData();
            this.getView().getModel("LoginModel").setProperty("/HeaderName", "Payslip Deduction");
            this.i18nModel = this.getView().getModel("i18n").getResourceBundle();
            this.getView().byId("PD_id_employeeID").setSelectedKey("");
            this._fetchInitialPayslipDeduction();
            var model = new JSONModel({
                EmployeeID: "",
                Description: "",
                Amount: "",
                Type: "",
                StartDate: "",
                EndDate: "",
                Status: "Active",
                Currency: "INR"
            });
            this.getView().setModel(model, "PayslipformModel");
        },

        _fetchInitialPayslipDeduction: async function() {
            try {
                this.getBusyDialog();

                const response = await this.ajaxReadWithJQuery("PayslipDeduction", {});

                if (response.success) {
                    this.closeBusyDialog();
                    const aData = Array.isArray(response.data) ? response.data : [response.data];

                    // Table Model (filtered data)
                    this.getView().setModel(new JSONModel(aData), "PayslipModel");
                } else {
                    this.closeBusyDialog();
                    MessageToast.show("Failed to load data");
                }
            } catch (error) {
                this.closeBusyDialog();
                MessageToast.show("Error while loading data");
            }
        },

        onSearch: function() {
            this._fetchPayslipDeduction();
        },

        _fetchPayslipDeduction: async function() {
            try {
                this.getBusyDialog();

                var sEmployeeID = this.byId("PD_id_employeeID").getSelectedKey();

                var oPayload = {};

                if (sEmployeeID) {
                    oPayload.EmployeeID = sEmployeeID;
                }

                const response = await this.ajaxReadWithJQuery("PayslipDeduction", oPayload);

                this.closeBusyDialog();

                if (response.success) {

                    const aData = Array.isArray(response.data) ? response.data : [response.data];

                    // ONLY update table model
                    this.getView().setModel(new JSONModel(aData), "PayslipModel");

                } else {
                    MessageToast.show("No data found");
                }

            } catch (error) {
                this.closeBusyDialog();
                MessageToast.show("Error while filtering data");
            }
        },

        CA_onPressClear: function() {
            this.getView().byId("PD_id_employeeID").setSelectedKey("")
        },

        _openAllowanceDialog: function(sMode, oData) {
            var oView = this.getView();
            var that = this;

            // Store mode globally (or in model)
            this._sDialogMode = sMode;

            if (!this._pDialog) {
                this._pDialog = sap.ui.core.Fragment.load({
                    id: oView.getId(),
                    name: "sap.kt.com.minihrsolution.fragment.PayslipDeduction",
                    controller: this
                }).then(function(oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }

            this._pDialog.then(function(oDialog) {

                // Reset model before opening
                var oModel = new JSONModel();

                if (sMode === "CREATE") {
                    oModel.setData({
                        // empty fields
                        EmployeeID: "",
                        Description: "",
                        Amount: "",
                        Type: "",
                        StartDate: "",
                        EndDate: "",
                        Status: "Active",
                        Currency: "INR"
                    });
                } else if (sMode === "UPDATE") {
                    var oUpdateData = Object.assign({}, oData);
                    if (oUpdateData.EmployeeID && typeof oUpdateData.EmployeeID === "string") {
                        oUpdateData.EmployeeID = oUpdateData.EmployeeID.split(",").map(function(sId) {
                            return sId.trim();
                        }).filter(function(sId) {
                            return sId;
                        });
                    }
                    oModel.setData(oUpdateData); // bind selected row data
                }

                oView.setModel(oModel, "PayslipformModel");
                var oModeModel = new JSONModel({
                    isCreate: sMode === "CREATE",
                    isUpdate: sMode === "UPDATE"
                });

                oView.setModel(oModeModel, "modeModel");

                oDialog.open();
            });
        },

        CA_create: function() {
            this._openAllowanceDialog("CREATE");
        },

        onCancelPayslip: function() {
            var oView = this.getView();

            // 1. Clear Model Data
            var oModel = oView.getModel("PayslipformModel");
            if (oModel) {
                oModel.setData({
                    EmployeeID: "",
                    Description: "",
                    Amount: "",
                    Type: "",
                    StartDate: "",
                    EndDate: "",
                    Status: "",
                    Currency: "INR"
                });
            }

            // 2. Clear ValueStates
            this._clearAllowanceFormValidation();
            var oTable = this.byId("PD_id_Table");
            if (oTable) {
                oTable.removeSelections(true);
            }

            // 3. Close Dialog
            this._pDialog.then(function(oDialog) {
                oDialog.close();
            });
        },

        _clearAllowanceFormValidation: function() {
            var aControls = [
                this.byId("PD_ID_EmployeeID"),
                this.byId("PD_ID_DescriptionInput"),
                this.byId("PD_ID_Type"),
                this.byId("PD_ID_StartDate"),
                this.byId("PD_ID_EndDate"),
                this.byId("PD_ID_AmountInput"),
                this.byId("PD_ID_CurrencyComboBox"),
                this.byId("PD_ID_Status")
            ];

            aControls.forEach(function(oControl) {
                if (oControl) {
                    oControl.setValueState(sap.ui.core.ValueState.None);
                }
            });
        },

        onCA_update: function() {
            var oTable = this.byId("PD_id_Table");
            var oSelectedItem = oTable.getSelectedItem();

            if (!oSelectedItem) {
                MessageToast.show("Please select a row");
                return;
            }

            var oContext = oSelectedItem.getBindingContext("PayslipModel");

            if (!oContext) {
                MessageToast.show("Binding context not found");
                return;
            }

            var oData = oContext.getObject();
            oData.StartDate = this.Formatter.formatDate(oData.StartDate);
            oData.EndDate = this.Formatter.formatDate(oData.EndDate);

            this._openAllowanceDialog("UPDATE", oData);
        },

        onEmployeeIDChange: function(oEvent) {
            utils._LCstrictValidationComboBox(oEvent)
        },

        onDescriptionLiveChange: function(oEvent) {
            utils._LCvalidateMandatoryField(oEvent)
        },

        onChangeType: function(oEvent) {
            utils._LCstrictValidationComboBox(oEvent)
        },

        onDatePickerChange: function(oEvent) {
            utils._LCvalidateDate(oEvent, "oEvent");

            var oStartDate = oEvent.getSource().getDateValue(); // proper Date object

            if (oStartDate) {
                var oEndDatePicker = this.byId("PD_ID_EndDate");
                oEndDatePicker.setMinDate(oStartDate);

                // clear invalid end date if already selected
                var oEndDate = oEndDatePicker.getDateValue();
                if (oEndDate && oEndDate < oStartDate) {
                    oEndDatePicker.setDateValue(null);
                }
            }
        },

        onEndDateChange: function(oEvent) {
            utils._LCvalidateDate(oEvent, "oEvent");

            var oEndDate = oEvent.getSource().getDateValue();
            var oStartDate = this.byId("PD_ID_StartDate").getDateValue();

            if (oStartDate && oEndDate && oEndDate < oStartDate) {
                oEvent.getSource().setValueState("Error");
                oEvent.getSource().setValueStateText("End Date cannot be before Start Date");
            } else {
                oEvent.getSource().setValueState("None");
            }
        },

        onAmountLiveChange: function(oEvent) {
            var oInput = oEvent.getSource();
            var sValue = oInput.getValue();

            // Allow only digits and one decimal point
            sValue = sValue.replace(/[^0-9.]/g, "");

            // Ensure only one decimal point
            var aParts = sValue.split(".");
            if (aParts.length > 2) {
                sValue = aParts[0] + "." + aParts[1];
            }

            // Restrict to 2 decimal places
            if (aParts[1]) {
                aParts[1] = aParts[1].substring(0, 2);
                sValue = aParts[0] + "." + aParts[1];
            }

            // Restrict total digits (excluding decimal point)
            var sDigitsOnly = sValue.replace(".", "");
            if (sDigitsOnly.length > 20) {
                sDigitsOnly = sDigitsOnly.substring(0, 20);

                // Reconstruct value with decimal if exists
                if (sValue.includes(".")) {
                    var iDecimalIndex = sValue.indexOf(".");
                    var iDecimalLength = sValue.length - iDecimalIndex - 1;
                    sValue = sDigitsOnly.substring(0, sDigitsOnly.length - iDecimalLength) +
                        "." +
                        sDigitsOnly.substring(sDigitsOnly.length - iDecimalLength);
                } else {
                    sValue = sDigitsOnly;
                }

                oInput.setValueState(sap.ui.core.ValueState.Error);
                oInput.setValueStateText("Maximum 20 digits allowed");
            } else {
                oInput.setValueState(sap.ui.core.ValueState.None);
            }

            oInput.setValue(sValue);

            // Mandatory validation
            utils._LCvalidateMandatoryField(oEvent);
        },

        onCurrencyChange: function(oEvent) {
            utils._LCstrictValidationComboBox(oEvent);
        },

        onChangeStatus: function(oEvent) {
            utils._LCstrictValidationComboBox(oEvent);
        },

        onCreatePayslip: async function() {
            var oView = this.getView();
            var oModel = oView.getModel("PayslipformModel");
            var oData = oModel.getData();

            // Validation
            var isMandatoryValid = (
                    utils._LCstrictValidationComboBox(this.byId(("PD_ID_EmployeeID")), "ID") &&
                    utils._LCvalidateMandatoryField(this.byId(("PD_ID_DescriptionInput")), "ID") &&
                    utils._LCstrictValidationComboBox(this.byId(("PD_ID_Type")), "ID") &&
                    utils._LCvalidateDate(this.byId("PD_ID_StartDate"), "ID") &&
                    utils._LCvalidateDate(this.byId("PD_ID_EndDate"), "ID") &&
                    utils._LCvalidateMandatoryField(this.byId(("PD_ID_AmountInput")), "ID") &&
                    utils._LCstrictValidationComboBox(this.byId(("PD_ID_CurrencyComboBox")), "ID")) &&
                utils._LCstrictValidationComboBox(this.byId(("PD_ID_Status")), "ID")

            if (!isMandatoryValid) {
                MessageToast.show("Please fill all mandatory details");
                return false;
            }

            try {

                // 1. Prepare Payload (IMPORTANT)
                var aPayloadData = {
                    ID: "",
                    EmployeeID: oData.EmployeeID,
                    Description: oData.Description,
                    Type: oData.Type,
                    StartDate: oData.StartDate.split("/").reverse().join("-"),
                    EndDate: oData.EndDate.split("/").reverse().join("-"),
                    Amount: Number(oData.Amount),
                    Currency: oData.Currency,
                    Status: oData.Status
                };

                var oPayload = {
                    data: aPayloadData
                };
                this.getBusyDialog();
                // 2. AJAX Call
                const response = await this.ajaxCreateWithJQuery("PayslipDeduction", oPayload);

                // 3. Success Handling
                if (response.success) {

                    MessageToast.show("Allowance created successfully");
                    this._fetchInitialPayslipDeduction();
                    this.onCancelPayslip()
                    this._pDialog.then(function(oDialog) {
                        oDialog.close();
                    });

                } else {
                    this.closeBusyDialog();
                    MessageToast.show(this.i18nModel.getText("Creation Failed"));
                }

                // 4. Reset Form + Close Dialog
                this.onCancelPayslip();
            } catch (error) {
                this.closeBusyDialog();
                console.error("Create Allowance Error:", error);
                MessageToast.show("Error while creating allowance");

            }
        },

        onUpdatePaylsip: async function() {
            var oView = this.getView();
            var oModel = oView.getModel("PayslipformModel");
            var oData = oModel.getData();

            // Validation
            var isMandatoryValid = (
                    utils._LCstrictValidationComboBox(this.byId(("PD_ID_EmployeeID")), "ID") &&
                    utils._LCvalidateMandatoryField(this.byId(("PD_ID_DescriptionInput")), "ID") &&
                    utils._LCstrictValidationComboBox(this.byId(("PD_ID_Type")), "ID") &&
                    utils._LCvalidateDate(this.byId("PD_ID_StartDate"), "ID") &&
                    utils._LCvalidateDate(this.byId("PD_ID_EndDate"), "ID") &&
                    utils._LCvalidateMandatoryField(this.byId(("PD_ID_AmountInput")), "ID") &&
                    utils._LCstrictValidationComboBox(this.byId(("PD_ID_CurrencyComboBox")), "ID")) &&
                utils._LCstrictValidationComboBox(this.byId(("PD_ID_Status")), "ID")


            if (!isMandatoryValid) {
                MessageToast.show("Please fill mandatory details");
                return false;
            }

            try {
                this.getBusyDialog();

                // 1. Prepare Payload with data and filters
                var oPayload = {
                    data: {
                        ID: oData.ID,
                        EmployeeID: oData.EmployeeID,
                        Description: oData.Description,
                        Type: oData.Type,
                        StartDate: oData.StartDate.split("/").reverse().join("-"),
                        EndDate: oData.EndDate.split("/").reverse().join("-"),
                        Amount: Number(oData.Amount),
                        Currency: oData.Currency,
                        Status: oData.Status
                    },
                    filters: {
                        ID: oData.ID
                    }
                };

                // 2. AJAX Call
                const response = await this.ajaxUpdateWithJQuery("PayslipDeduction", oPayload);

                // 3. Success Handling
                if (response.success) {
                    this.closeBusyDialog();
                    MessageToast.show("Allowance updated successfully");
                    this._fetchInitialPayslipDeduction();
                    this._pDialog.then(function(oDialog) {
                        oDialog.close();
                    });
                } else {
                    this.closeBusyDialog();
                    MessageToast.show(this.i18nModel.getText("Update Failed"));
                }

            } catch (error) {
                this.closeBusyDialog();
                console.error("Update Allowance Error:", error);
                MessageToast.show("Error while updating allowance");
            }
        },

        onCA_delete: async function() {
            var oTable = this.byId("PD_id_Table");
            var oSelectedItem = oTable.getSelectedItem();

            if (!oSelectedItem) {
                MessageToast.show("Please select a row");
                return;
            }

            var oContext = oSelectedItem.getBindingContext("PayslipModel");

            if (!oContext) {
                MessageToast.show("Binding context not found");
                return;
            }

            var oData = oContext.getObject();
            var sID = oData.ID;

            // Show confirmation dialog
            var that = this;
            sap.m.MessageBox.confirm("Are you sure you want to delete this payslip data?", {
                title: "Confirm Delete",
                actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
                onClose: async function(sAction) {
                    if (sAction === sap.m.MessageBox.Action.OK) {
                        try {
                            that.getBusyDialog();

                            // Prepare Payload with filters only
                            var oPayload = {
                                filters: {
                                    ID: sID
                                }
                            };

                            // AJAX Call for delete
                            const response = await that.ajaxDeleteWithJQuery("PayslipDeduction", oPayload);

                            // Success Handling
                            if (response.success) {
                                MessageToast.show("Payslip data deleted successfully");
                                that._fetchInitialPayslipDeduction();
                            } else {
                                that.closeBusyDialog();
                                MessageToast.show(that.i18nModel.getText("Delete Failed"));
                            }

                        } catch (error) {
                            that.closeBusyDialog();
                            console.error("Delete paylsip Error:", error);
                            MessageToast.show("Error while deleting paylsip");
                        }
                    }
                }
            });
        },

        onHome: function() {
            this.CommonLogoutFunction();
        },

        onPressback: function() {
            this.getOwnerComponent().getRouter().navTo("RouteTilePage");
        },

        onLogout: function() {
            this.getOwnerComponent().getRouter().navTo("RouteLoginPage");
        },
    });
});