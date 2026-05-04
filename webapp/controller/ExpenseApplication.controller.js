sap.ui.define([
    "./BaseController",
    "../utils/validation",
    "sap/m/MessageToast",
    "../model/formatter",
    "sap/ui/model/json/JSONModel",
], function (Controller, utils, MessageToast, Formatter, JSONModel) {
    "use strict";
    return Controller.extend("sap.kt.com.minihrsolution.controller.ExpenseApplication", {
        Formatter: Formatter,
        onInit: function () {
            this.getRouter().getRoute("RouteExpensePage").attachMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: async function (oEvent) {
            var LoginFUnction = await this.commonLoginFunction("Expense");
            if (!LoginFUnction) return;

            this.getBusyDialog();
            try {
                this.LoginModel = this.getView().getModel("LoginModel");

                if (!this.getView().getModel("ExpenseTypeModel")) this._fetchCommonData("ExpenseItemType", "ExpenseTypeModel");
                if (!this.getView().getModel("ManagerModel")) this._fetchCommonData("ManagerFunction", "ManagerModel", {
                    ManagerID: this.LoginModel.getProperty("/EmployeeID")
                });

                var FileName = oEvent.getParameter("arguments").FileName;
                (FileName !== "ExpenseApplication") ? this._isClearPressed = true : this._isClearPressed = false
                if (FileName === "ExpenseApplication") {
                    const filterItems = this.byId("Exp-id-FilterBar").getFilterGroupItems();

                    filterItems.forEach(item => {
                        const control = item.getControl();

                        if (!control) return;

                        // 🔹 Input / ComboBox
                        if (control.setValue) {
                            control.setValue("");
                        }

                        // 🔹 DateRangeSelection
                        // if (control.setDateValue && control.setSecondDateValue) {
                        //   control.setDateValue(null);
                        //   control.setSecondDateValue(null);
                        // }

                        // 🔹 ComboBox / Select
                        if (control.setSelectedKey) {
                            control.setSelectedKey("");
                        }

                        // 🔹 MultiComboBox
                        if (control.setSelectedKeys) {
                            control.setSelectedKeys([]);
                        }
                    });
                }

                const minDate = new Date();
                minDate.setMonth(new Date().getMonth() - 3);

                if (!this.getOwnerComponent().getModel("viewModel")) {
                    var View = new JSONModel({
                        SaveBtn: false,
                        SubmitBtn: false,
                        required: true,
                        maxDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
                        minDate: minDate
                        // finacialStart: startDate,
                        // finacialEnd: endDate
                    });
                    this.getOwnerComponent().setModel(View, "viewModel");
                }
                this.ViewModel = this.getOwnerComponent().getModel("viewModel");
                // const oFilterState = this.ViewModel?.getProperty("/ExpenseFilterState");
                // const dateRangeControl = this.byId("Exp_id_InvoiceDatePicker");

                // if (oFilterState?.fromDetail) {
                //     dateRangeControl.setDateValue(oFilterState.startDate);
                //     dateRangeControl.setSecondDateValue(oFilterState.endDate);
                //     this.ViewModel.setProperty("/ExpenseFilterState/fromDetail", false);
                // } else {
                //     dateRangeControl.setDateValue(startDate);
                //     dateRangeControl.setSecondDateValue(endDate);
                // }
                this.i18nModel = this.getView().getModel("i18n").getResourceBundle();
                this.CommonModel();
                this.getView().getModel("LoginModel").setProperty("/HeaderName", "Expense Details");
                if (FileName !== "ExpenseDetails") {
                    this.onClearAndSearch("Exp-id-FilterBar")

                    const currentYear = new Date().getFullYear();
                    let fyStart, fyEnd;
                    if (new Date().getMonth() >= 3) {
                        fyStart = new Date(currentYear, 3, 1); // April 1
                        fyEnd = new Date(currentYear + 1, 2, 31); // March 31 next year
                    } else {
                        fyStart = new Date(currentYear - 1, 3, 1); // April 1 last year
                        fyEnd = new Date(currentYear, 2, 31); // March 31 this year
                    }
                    const dateRangeControl = this.byId("Exp_id_InvoiceDatePicker"); // Set the date range UI
                    if (dateRangeControl) {
                        dateRangeControl.setDateValue(fyStart);
                        dateRangeControl.setSecondDateValue(fyEnd);
                    }
                }
                this.onChangeEmployeeID();
                await this.Exp_onSearch();
            } catch (error) {
                this.closeBusyDialog();
                MessageToast.show(error.message || error.responseText);
            } finally {
                this.closeBusyDialog();
            }
            this.initializeBirthdayCarousel();
        },

        onTableSelectionChange: function (oEvent) {
            var Status = oEvent.getSource().getSelectedItem().getBindingContext("ExpenseModel").getObject().Status;
            this.DeleteExpID = oEvent.getSource().getSelectedItem().getBindingContext("ExpenseModel").getObject().ExpenseID;
            if (Status === "Draft") {
                this.byId("Exp_id_DeleteBtn").setEnabled(true);
            } else {
                this.byId("Exp_id_DeleteBtn").setEnabled(false);
            }
        },

        onChangeEmployeeID: async function (params) {
            var selectedItem = this.byId("Exp_id_EmployeeName").getSelectedItem();
            var EmployeeID = selectedItem ? selectedItem.getText() : this.LoginModel.getProperty("/EmployeeID");

            if (params && params.EmployeeID) { // Override EmployeeID if params are passed
                EmployeeID = params.EmployeeID;
            }

            const fetchParams = {
                EmployeeID: EmployeeID
            };

            if (params?.startDate && params?.endDate) {
                fetchParams.startDate = params.startDate;
                fetchParams.endDate = params.endDate;
            }

            await this._fetchCommonData("Expense", "FilterExpenseModel", fetchParams);

            var FilterModel = this.getView().getModel("FilterExpenseModel");
            if (FilterModel) {
                var data = FilterModel.getData();
                data = data.filter(item => item.ExpenseName && item.Source && item.Destination);
                var uniqueExpenseName = [...new Map(data.map(item => [item.ExpenseName, item])).values()];
                var uniqueSource = [...new Map(data.map(item => [item.Source, item])).values()];
                var uniqueDestination = [...new Map(data.map(item => [item.Destination, item])).values()];
                FilterModel.setData({
                    ExpenseNameSet: uniqueExpenseName,
                    SourceSet: uniqueSource,
                    DestinationSet: uniqueDestination
                });
            }
        },

        // Function to initialize the common model for expense creation
        CommonModel: function () {
            var oModel = new JSONModel({
                EmployeeID: this.LoginModel.getProperty("/EmployeeID"),
                EmployeeName: this.LoginModel.getProperty("/EmployeeName"),
                ExpenseName: "",
                ExpStartDate: "",
                ExpEndDate: "",
                TravelAllowance: "",
                Country: "",
                Source: "",
                Destination: "",
                DestinationCountry: "",
                DestinationState: "",
                CostCenter: "Kvriksha Technologies Private Limited Kalaburagi",
                TripType: "",
                Comments: "",
                Status: "Draft"
            });
            this.getOwnerComponent().setModel(oModel, "CreateExpenseModel");
        },

        // Navigate back to the tile page
        onPressback: function () {
            this.getRouter().navTo("RouteTilePage");
        },

        onLogout: function () {
            this.CommonLogoutFunction();
        },

        // Open the "Add Expense" fragment
        Exp_onPressAddExpense: function () {
            this.CommonModel();
            var oView = this.getView();
            if (this.Expense) {
                this.Expense.destroy();
                this.Expense = null;
            }
            if (!this.Expense) {
                this.Expense = sap.ui.core.Fragment.load({
                    name: "sap.kt.com.minihrsolution.fragment.AddExpense",
                    controller: this
                }).then(function (Expense) {
                    this.Expense = Expense;
                    oView.addDependent(this.Expense);
                    this.Expense.open();
                    this._FragmentDatePickersReadOnly(["exp-Id-StartDate", "exp-Id-EndDate"])
                }.bind(this));
            } else {
                this.Expense.open();
                this._FragmentDatePickersReadOnly(["exp-Id-StartDate", "exp-Id-EndDate"])
            }
        },

        // Close the "Add Expense" fragment and reset validation states
        Exp_Frg_onPressClose: function () {
            this.Expense.close();
            var core = sap.ui.getCore();
            core.byId("exp-Id-ExpenseName").setValueState("None");
            core.byId("exp-Id-StartDate").setValueState("None");
            core.byId("exp-Id-EndDate").setValueState("None");
            core.byId("exp-Id-Country").setValueState("None");
            core.byId("exp-Id-State").setValueState("None");
            core.byId("exp-Id-Source").setValueState("None");
            core.byId("exp-Id-Destination").setValueState("None");
            core.byId("exp-Id-EmployeeRemark").setValueState("None");
        },

        // Submit the expense after validation
        Exp_Frg_onPressSubmit: async function () {
            var that = this;
            try {
                const isValid =
                    utils._LCvalidateMandatoryField(sap.ui.getCore().byId("exp-Id-ExpenseName"), "ID") &&
                    utils._LCvalidateDate(sap.ui.getCore().byId("exp-Id-StartDate"), "ID") &&
                    utils._LCvalidateDate(sap.ui.getCore().byId("exp-Id-EndDate"), "ID") &&
                    utils._LCstrictValidationComboBox(sap.ui.getCore().byId("exp-Id-TravelAllowance"), "ID") &&
                    utils._LCstrictValidationComboBox(sap.ui.getCore().byId("exp-Id-Country"), "ID") &&
                    utils._LCstrictValidationComboBox(sap.ui.getCore().byId("exp-Id-State"), "ID") &&
                    utils._LCvalidateMandatoryField(sap.ui.getCore().byId("exp-Id-Source"), "ID") &&
                    (this.ViewModel.getProperty("/required") === true ? utils._LCvalidateMandatoryField(sap.ui.getCore().byId("exp-Id-DestinationCountry"), "ID") : true) &&
                    (this.ViewModel.getProperty("/required") === true ? utils._LCvalidateMandatoryField(sap.ui.getCore().byId("exp-Id-DestinationState"), "ID") : true) &&
                    (this.ViewModel.getProperty("/required") === true ? utils._LCvalidateMandatoryField(sap.ui.getCore().byId("exp-Id-Destination"), "ID") : true) &&
                    utils._LCstrictValidationComboBox(sap.ui.getCore().byId("exp-Id-ExpenseType"), "ID") &&
                    utils._LCvalidateMandatoryField(sap.ui.getCore().byId("exp-Id-EmployeeRemark"), "ID");

                if (!isValid) {
                    return MessageToast.show(this.i18nModel.getText("mandetoryFields"));
                }
                const oModel = this.getView().getModel("CreateExpenseModel").getData();
                oModel.ExpStartDate = oModel.ExpStartDate.split("/").reverse().join("-");
                oModel.ExpEndDate = oModel.ExpEndDate.split("/").reverse().join("-");
                this.getBusyDialog();
                const oResponse = await that.ajaxCreateWithJQuery("Expense", {
                    data: oModel
                });
                if (oResponse) {
                    that.Expense.close();
                    // await that.Exp_onPressClear();
                    await that._fetchCommonData("ExpenseTotalCalculation", "", {
                        ExpenseID: oResponse.ExpenseID
                    });
                    this.closeBusyDialog();
                    that.onChangeEmployeeID();
                    that._isClearPressed = false
                    await that.Exp_onSearch();
                    MessageToast.show(that.i18nModel.getText("expenseCreatedMess"));
                } else {
                    MessageToast.show(that.i18nModel.getText("expenseCreatedMessFailed"));
                }
            } catch (oError) {
                MessageToast.show(that.i18nModel.getText("expenseCreatedMessFailed"));
            } finally {
                this.closeBusyDialog();
            }
        },

        Exp_onCheckExpenseDetails: function (oEvent) {
            const oDate = this.byId("Exp_id_InvoiceDatePicker");
            this.getOwnerComponent().getModel("viewModel").setProperty("/ExpenseFilterState", {
                startDate: oDate.getDateValue(),
                endDate: oDate.getSecondDateValue(),
                fromDetail: true
            });
            var ExpenseID = oEvent.getSource().getBindingContext("ExpenseModel").getObject().ExpenseID;
            this.getRouter().navTo("RouteExpensDetails", {
                sPath: ExpenseID.replaceAll("/", "")
            });
        },

        Exp_onLiveExpenseName: function (oEvent) {
            utils._LCvalidateMandatoryField(oEvent, "oEvent");
        },

        Exp_onDatePickerChange: function (oEvent) {
            utils._LCvalidateDate(oEvent, "oEvent");
            sap.ui.getCore().byId("exp-Id-EndDate").setMinDate(new Date(oEvent.getSource().getValue().split("/").reverse().join('-')));
        },

        Exp_onEndDateChange: function (oEvent) {
            utils._LCvalidateDate(oEvent, "oEvent");
            // sap.ui.getCore().byId("exp-Id-EndDate").setMinDate(new Date(oEvent.getSource().getValue().split("/").reverse().join('-')));
        },

        Exp_onChangeCountry: function (oEvent) {
            utils._LCstrictValidationComboBox(oEvent, "oEvent");

            const oSource = oEvent.getSource();
            const sId = oSource.getId();
            const oItem = oSource.getSelectedItem();
            const oModel = this.getView().getModel("CreateExpenseModel");

            // Decide target controls (Source vs Destination)
            const bDestination = sId.includes("DestinationCountry");

            const oStateCombo = sap.ui.getCore().byId(
                bDestination ? "exp-Id-DestinationState" : "exp-Id-State"
            );
            const oCityCombo = sap.ui.getCore().byId(
                bDestination ? "exp-Id-Destination" : "exp-Id-Source"
            );

            // Clear dependent fields
            oStateCombo.setSelectedKey("");
            oStateCombo.getBinding("items")?.filter([]);
            oCityCombo.setSelectedKey("");
            oCityCombo.getBinding("items")?.filter([]);

            if (!oItem) {
                oModel.setProperty(bDestination ? "/DestinationCountry" : "/Country", "");
                oModel.setProperty(bDestination ? "/DestinationState" : "/State", "");
                oModel.setProperty(bDestination ? "/Destination" : "/Source", "");
                return;
            }

            const sCountryCode = oItem.getAdditionalText(); // IN
            const sCountryName = oItem.getText();

            // Filter states
            oStateCombo.getBinding("items")?.filter([
                new sap.ui.model.Filter("countryCode", sap.ui.model.FilterOperator.EQ, sCountryCode)
            ]);

            // Update model
            oModel.setProperty(
                bDestination ? "/DestinationCountry" : "/Country",
                sCountryName
            );
        },

        Exp_onChangeState: function (oEvent) {
            utils._LCstrictValidationComboBox(oEvent, "oEvent");

            const oSource = oEvent.getSource();
            const sId = oSource.getId();
            const oItem = oSource.getSelectedItem();
            const oModel = this.getView().getModel("CreateExpenseModel");

            const bDestination = sId.includes("DestinationState");

            const oCountryCB = sap.ui.getCore().byId(
                bDestination ? "exp-Id-DestinationCountry" : "exp-Id-Country"
            );
            const oCityCombo = sap.ui.getCore().byId(
                bDestination ? "exp-Id-Destination" : "exp-Id-Source"
            );

            // Clear cities
            oCityCombo.setSelectedKey("");
            oCityCombo.getBinding("items")?.filter([]);

            if (!oItem) {
                oModel.setProperty(bDestination ? "/DestinationState" : "/State", "");
                oModel.setProperty(bDestination ? "/Destination" : "/Source", "");
                return;
            }

            const sStateName = oItem.getKey() || oItem.getText();
            const sCountryCode = oCountryCB.getSelectedItem()?.getAdditionalText();

            // Filter cities
            oCityCombo.getBinding("items")?.filter([
                new sap.ui.model.Filter("stateName", sap.ui.model.FilterOperator.EQ, sStateName),
                new sap.ui.model.Filter("countryCode", sap.ui.model.FilterOperator.EQ, sCountryCode)
            ]);

            // Update model
            oModel.setProperty(bDestination ? "/DestinationState" : "/State", sStateName);
        },

        Exp_onChangeSource: function (oEvent) {
            utils._LCvalidateMandatoryField(oEvent, "oEvent");
            if (oEvent.getSource().getValue() === '') {
                oEvent.getSource().setValueState("None");
            }
        },

        Exp_onChangeDestination: function (oEvent) {
            utils._LCvalidateMandatoryField(oEvent, "oEvent");
            if (oEvent.getSource().getValue() === '') {
                oEvent.getSource().setValueState("None");
            }
        },

        Exp_onChangeEmployeeRemark: function (oEvent) {
            utils._LCvalidateMandatoryField(oEvent, "oEvent");
        },

        Exp_onPressExpenseDownload: function () {
            let fileUrl = window.location.origin.split("index")[0] + "/Perdiem_DeclarationForm.doc";
            sap.m.URLHelper.redirect(fileUrl, true)
        },

        // Delete the Expenase and Expense Item
        Exp_onPressDeleteExpense: async function (oEvent) {
            var that = this;
            this.showConfirmationDialog(
                this.i18nModel.getText("msgBoxConfirm"),
                this.i18nModel.getText("commonMesBoxConfirmDelete"),
                async function () {
                    that.getBusyDialog();
                    try {
                        await that.ajaxDeleteWithJQuery("/Expense", {
                            filters: {
                                ExpenseID: that.DeleteExpID
                            }
                        });
                        that.onChangeEmployeeID();
                        that.Exp_onSearch();
                        that.byId("Exp_id_DeleteBtn").setEnabled(false);
                        MessageToast.show(that.i18nModel.getText("expenseDeleteMess")); // <== use 'that' instead of 'this'
                    } catch (error) {
                        MessageToast.show(error.responseText || "Error deleting expense");
                    } finally {
                        that.closeBusyDialog();
                    }
                },
                function () {
                    that.closeBusyDialog();
                })
        },

        //Filter Function
        Exp_onSearch: async function () {
            try {
                this.getBusyDialog();

                var oTable = this.getView().byId("exp_Id_Expense");
                oTable.setEnableBusyIndicator(true);

                const aFilterItems = this.byId("Exp-id-FilterBar").getFilterGroupItems();

                const params = {
                    EmployeeID: this.LoginModel.getProperty("/EmployeeID")
                };

                const dateRangeControl = this.byId("Exp_id_InvoiceDatePicker");

                let startDate = dateRangeControl?.getDateValue();
                let endDate = dateRangeControl?.getSecondDateValue();

                let dateRangeProvided = !!(startDate && endDate);

                aFilterItems.forEach((oItem) => {
                    const oControl = oItem.getControl();
                    const sKey = oItem.getName();

                    if (sKey === "ExpenseDate") return;

                    if (oControl && typeof oControl.getValue === "function") {
                        const sValue = oControl.getValue().trim();
                        if (sValue) {
                            params[sKey] = sValue;
                        }
                    }
                });
                const formatDate = (date) => date.toISOString().split("T")[0];


                params.startDate = startDate ? formatDate(startDate) : "";
                params.endDate = endDate ? formatDate(endDate) : "";


                this._isManualSearch = true;

                await this._fetchCommonData("Expense", "ExpenseModel", params, ["exp_Id_Expense"]);
                this.onChangeEmployeeID(params);
                this.closeBusyDialog();

            } catch (error) {
                this.closeBusyDialog();
                sap.m.MessageToast.show(
                    this.i18nModel.getText("commonErrorMessage")
                );
            }
        },

        Exp_onPressClear: async function () {
            this.byId("Exp_id_EmployeeName").setSelectedKey("");
            this.byId("Exp_id_SourceFilter").setSelectedKey("");
            this.byId("Exp_id_DestinationFilter").setSelectedKey("");
            this.byId("Exp_id_StatusFilter").setSelectedKey("");
            this.byId("Exp_id_InvoiceDatePicker").setValue("");
            this._isClearPressed = true;
        },

        Exp_onChangeExpenseType: function (oEvent) {
            if (oEvent.getSource()._getSelectedItemText() !== 'Customer Facing') {
                this.ViewModel.setProperty("/required", false);
            } else {
                this.ViewModel.setProperty("/required", true);
            }
            utils._LCstrictValidationComboBox(oEvent.getSource(), "ID");
        },

        getGroupHeader: function (oGroup) {
            return this.getStyledGroupHeader(oGroup);
        },

        exp_validateTravelAllownce: function (oEvent) {
            utils._LCstrictValidationComboBox(oEvent.getSource(), "ID");
        }

    });
});