sap.ui.define([
    "./BaseController",
    "../model/formatter",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "../utils/validation",
    "sap/ui/export/Spreadsheet"
], function (BaseController, Formatter, JSONModel, MessageToast, utils, Spreadsheet) {
    "use strict";

    return BaseController.extend("sap.kt.com.minihrsolution.controller.CreateAllowance", {
        Formatter: Formatter,
        onInit: function () {
            this.getRouter().getRoute("RouteCreateAllowance").attachMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: async function (oEvent) {
            var LoginFUnction = await this.commonLoginFunction("CreateAllowanceApp");
            if (!LoginFUnction) return;
            this.onClearAndSearch("CA_id_FilterBar");// Clear and search function
            var oModel = new JSONModel(this.getView().getModel("EmpModel").getData());
            this.getView().setModel(oModel, "EmpModel");

            this.getView().getModel("CurrencyModel").getData();
            this.getView().getModel("LoginModel").setProperty("/HeaderName", "Allowance Record");
            this.i18nModel = this.getView().getModel("i18n").getResourceBundle();
            this.getView().byId("CA_id_Allowancename").setSelectedKey("");
           this._fetchInitialAllowanceData();
            var model = new JSONModel({
                AllowanceType: "",
                Description: "",
                Amount: "",
                Currency: "INR",
                EmployeeID: []

            });
            this.getView().setModel(model, "AllowanceformModel");


        },
        _fetchInitialAllowanceData: async function () {

    try {
        this.getBusyDialog();

        const response = await this.ajaxReadWithJQuery("AllowanceData", {});

        if (response.success) {
             this.closeBusyDialog();
            const aData = Array.isArray(response.data)
                ? response.data
                : [response.data];

            // Table Model (filtered data)
            this.getView().setModel(new JSONModel(aData), "AllowanceModel");

            // Dropdown Model (always full data)
            this.getView().setModel(new JSONModel(aData), "AllowanceDropdownModel");

        } else {
             this.closeBusyDialog();
           MessageToast.show("Failed to load data");
        }

    } catch (error) {
        this.closeBusyDialog();
        MessageToast.show("Error while loading data");
    }
},

onSearch: function () {
    this._fetchAllowanceData();
},

       _fetchAllowanceData: async function () {

    try {
        this.getBusyDialog();

        var sAllowanceName = this.byId("CA_id_Allowancename").getSelectedKey();

        var oPayload = {};

        if (sAllowanceName) {
            oPayload.AllowanceType = sAllowanceName;
        }

        const response = await this.ajaxReadWithJQuery("AllowanceData", oPayload);

        this.closeBusyDialog();

        if (response.success) {

            const aData = Array.isArray(response.data)
                ? response.data
                : [response.data];

            // ONLY update table model
            this.getView().setModel(new JSONModel(aData), "AllowanceModel");

        } else {
            MessageToast.show("No data found");
        }

    } catch (error) {
        this.closeBusyDialog();
        MessageToast.show("Error while filtering data");
    }
},

        CA_onPressClear: function () {
            this.getView().byId("CA_id_Allowancename").setSelectedKey("")

        },

        _openAllowanceDialog: function (sMode, oData) {
            var oView = this.getView();
            var that = this;

            // Store mode globally (or in model)
            this._sDialogMode = sMode;

            if (!this._pDialog) {
                this._pDialog = sap.ui.core.Fragment.load({
                    id: oView.getId(),
                    name: "sap.kt.com.minihrsolution.fragment.CreateAllowance",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }

            this._pDialog.then(function (oDialog) {

                // Reset model before opening
                var oModel = new JSONModel();

                if (sMode === "CREATE") {
                    oModel.setData({
                        // empty fields
                        AllowanceType: "",
                        AllowanceDescription: "",
                        Amount: "",
                        Currency: "INR",
                        EmployeeID: []
                    });
                } else if (sMode === "UPDATE") {
                    var oUpdateData = Object.assign({}, oData);
                    if (oUpdateData.EmployeeID && typeof oUpdateData.EmployeeID === "string") {
                        oUpdateData.EmployeeID = oUpdateData.EmployeeID.split(",").map(function (sId) {
                            return sId.trim();
                        }).filter(function (sId) {
                            return sId;
                        });
                    }
                    oModel.setData(oUpdateData); // bind selected row data
                }

                oView.setModel(oModel, "AllowanceformModel");
                var oModeModel = new JSONModel({
                    isCreate: sMode === "CREATE",
                    isUpdate: sMode === "UPDATE"
                });

                oView.setModel(oModeModel, "modeModel");

                oDialog.open();
            });
        },
        CA_create: function () {
            this._openAllowanceDialog("CREATE");
        },
        onCancelAllowance: function () {
            var oView = this.getView();

            // 1. Clear Model Data
            var oModel = oView.getModel("AllowanceformModel");
            if (oModel) {
                oModel.setData({
                    AllowanceType: "",
                    AllowanceDescription: "",
                    Amount: "",
                    Currency: "",
                    EmployeeID: []
                });
            }

            // 2. Clear ValueStates
            this._clearAllowanceFormValidation();
            var oTable = this.byId("CA_idTable");
            if (oTable) {
                oTable.removeSelections(true);
            }

            // 3. Close Dialog
            this._pDialog.then(function (oDialog) {
                oDialog.close();
            });
        },
        _clearAllowanceFormValidation: function () {

            var aControls = [
                this.byId("ID_AllowanceTypeInput"),
                this.byId("ID_AllowanceDescriptionInput"),
                this.byId("ID_AllowanceAmountInput"),
                this.byId("ID_CurrencyComboBox"),
                this.byId("ID_EmployeeMultiComboBox")
            ];

            aControls.forEach(function (oControl) {
                if (oControl) {
                    oControl.setValueState(sap.ui.core.ValueState.None);
                }
            });
        },

        onCA_update: function () {
            var oTable = this.byId("CA_idTable");
            var oSelectedItem = oTable.getSelectedItem();

            if (!oSelectedItem) {
               MessageToast.show("Please select a row");
                return;
            }

            var oContext = oSelectedItem.getBindingContext("AllowanceModel");

            if (!oContext) {
                MessageToast.show("Binding context not found");
                return;
            }

            var oData = oContext.getObject();
            this._openAllowanceDialog("UPDATE", oData);
        },
        onAllowanceDescriptionLiveChange: function (oEvent) {
            utils._LCvalidateMandatoryField(oEvent)
        },
       onAllowanceAmountLiveChange: function (oEvent) {
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

        onEmployeeSelectionChange: function (oEvent) {
    var oControl = oEvent.getSource();

    // Delay required for MultiComboBox
    setTimeout(function () {
        utils._LCvalidationMultiComboBox(oControl);
    }, 0);
},
        onAllowanceTypeLiveChange: function (oEvent) {
            utils._LCvalidateMandatoryField(oEvent)
        },
        onCurrencyChange: function (oEvent) {
            utils._LCstrictValidationComboBox(oEvent);
        },

        onCreateAllowance: async function () {
            var oView = this.getView();
            var oModel = oView.getModel("AllowanceformModel");
            var oData = oModel.getData();

            // Validation
            var isMandatoryValid = (
                 utils._LCvalidateMandatoryField(this.byId(("ID_AllowanceTypeInput")), "ID")  &&
                 utils._LCvalidateMandatoryField(this.byId(("ID_AllowanceDescriptionInput")), "ID") && utils._LCvalidateMandatoryField(this.byId(("ID_AllowanceAmountInput")), "ID") &&
                utils._LCstrictValidationComboBox(this.byId(("ID_CurrencyComboBox")), "ID") &&
                utils._LCvalidationMultiComboBox(this.byId(("ID_EmployeeMultiComboBox")), "ID"))

            if (!isMandatoryValid) {
                MessageToast.show("Please fill mandatory booking details");
                return false;
            }

            try {

                // 1. Prepare Payload (IMPORTANT)
                var aPayloadData = {
                    AllowanceID: "", // backend will generate OR keep if update
                   
                    AllowanceType: oData.AllowanceType,
                    AllowanceDescription: oData.AllowanceDescription,
                    Amount: Number(oData.Amount), // ensure number
                    Currency: oData.Currency,
                    EmployeeID: oData.EmployeeID || []
                };

                var oPayload = {
                    data: aPayloadData
                };
                this.getBusyDialog();
                // 2. AJAX Call
                const response = await this.ajaxCreateWithJQuery("AllowanceData", oPayload);

                // 3. Success Handling
                if (response.success) {
                  
                    MessageToast.show("Allowance created successfully");
                    this._fetchInitialAllowanceData();
                    this.onCancelAllowance()
                    this._pDialog.then(function (oDialog) {
                        oDialog.close();
                    });

                }
                else {
                    this.closeBusyDialog();
                    MessageToast.show(this.i18nModel.getText("Creation Failed"));
                }


                // Optional: Refresh table / re-fetch data
                this._getAllowanceList && this._getAllowanceList();

                // 4. Reset Form + Close Dialog
                this.onCancelAllowance();

            } catch (error) {
this.closeBusyDialog();
                console.error("Create Allowance Error:", error);
                MessageToast.show("Error while creating allowance");

            }
        },
        onUpdateAllowance: async function () {
            var oView = this.getView();
            var oModel = oView.getModel("AllowanceformModel");
            var oData = oModel.getData();

            // Validation
            var isMandatoryValid = (
                   utils._LCvalidateMandatoryField(this.byId(("ID_AllowanceTypeInput")), "ID") &&
                utils._LCvalidateMandatoryField(this.byId(("ID_AllowanceDescriptionInput")), "ID") &&
                utils._LCvalidateMandatoryField(this.byId(("ID_AllowanceAmountInput")), "ID") &&
                utils._LCstrictValidationComboBox(this.byId(("ID_CurrencyComboBox")), "ID") &&
                utils._LCvalidationMultiComboBox(this.byId(("ID_EmployeeMultiComboBox")), "ID")
            );

            if (!isMandatoryValid) {
                MessageToast.show("Please fill mandatory booking details");
                return false;
            }

            try {
                this.getBusyDialog();

                // 1. Prepare Payload with data and filters
                var oPayload = {
                    data: {
                        AllowanceID: oData.AllowanceID, // ensure ID is sent for update
                         AllowanceType: oData.AllowanceType,
                        AllowanceDescription: oData.AllowanceDescription,
                        Amount: Number(oData.Amount),
                        Currency: oData.Currency,
                        EmployeeID: oData.EmployeeID || []
                    },
                    filters: {
                        AllowanceID: oData.AllowanceID
                    }
                };

                // 2. AJAX Call
                const response = await this.ajaxUpdateWithJQuery("AllowanceData", oPayload);

                // 3. Success Handling
                if (response.success) {
                    this.closeBusyDialog();
                    MessageToast.show("Allowance updated successfully");
                    this._fetchInitialAllowanceData();
                    this._pDialog.then(function (oDialog) {
                        oDialog.close();
                    });
                }
                else {
                    this.closeBusyDialog();
                    MessageToast.show(this.i18nModel.getText("Update Failed"));
                }

            } catch (error) {
                this.closeBusyDialog();
                console.error("Update Allowance Error:", error);
                MessageToast.show("Error while updating allowance");
            }
        },
        onCA_delete: async function () {
            var oTable = this.byId("CA_idTable");
            var oSelectedItem = oTable.getSelectedItem();

            if (!oSelectedItem) {
                MessageToast.show("Please select a row");
                return;
            }

            var oContext = oSelectedItem.getBindingContext("AllowanceModel");

            if (!oContext) {
                MessageToast.show("Binding context not found");
                return;
            }

            var oData = oContext.getObject();
            var sAllowanceID = oData.AllowanceID;

            // Show confirmation dialog
            var that = this;
            sap.m.MessageBox.confirm("Are you sure you want to delete this allowance?", {
                title: "Confirm Delete",
                actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
                onClose: async function (sAction) {
                    if (sAction === sap.m.MessageBox.Action.OK) {
                        try {
                            that.getBusyDialog();

                            // Prepare Payload with filters only
                            var oPayload = {
                                filters: {
                                    AllowanceID: sAllowanceID
                                }
                            };

                            // AJAX Call for delete
                            const response = await that.ajaxDeleteWithJQuery("AllowanceData", oPayload);

                            // Success Handling
                            if (response.success) {
                                MessageToast.show("Allowance deleted successfully");
                                that._fetchInitialAllowanceData();
                            } else {
                                that.closeBusyDialog();
                                MessageToast.show(that.i18nModel.getText("Delete Failed"));
                            }

                        } catch (error) {
                            that.closeBusyDialog();
                            console.error("Delete Allowance Error:", error);
                            MessageToast.show("Error while deleting allowance");
                        }
                    }
                }
            });
        },

        onHome: function () {
            this.CommonLogoutFunction();
        },

        onPressback: function () {
            this.getOwnerComponent().getRouter().navTo("RouteTilePage");
        },

        onLogout: function () {
            this.getOwnerComponent().getRouter().navTo("RouteLoginPage");
        },
    });
});