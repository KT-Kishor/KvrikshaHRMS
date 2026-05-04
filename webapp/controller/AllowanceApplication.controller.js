sap.ui.define([
    "./BaseController",
    "../utils/validation",
    "sap/m/MessageToast",
    "../model/formatter",
    "sap/ui/model/json/JSONModel",
], function(Controller, utils, MessageToast, Formatter, JSONModel) {
    "use strict";
    return Controller.extend("sap.kt.com.minihrsolution.controller.AllowanceApplication", {
        Formatter: Formatter,
        onInit: function() {
            this.getRouter().getRoute("RouteAllowancePage").attachMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: async function(oEvent) {
            var LoginFUnction = await this.commonLoginFunction("Allowance");
            if (!LoginFUnction) return;
            this.byId("All_id_DeleteBtn").setEnabled(false);
            this.getBusyDialog();
            try {
                this.LoginModel = this.getView().getModel("LoginModel");
                if (!this.getView().getModel("ManagerModel")) {
                    this._fetchCommonData("ManagerFunction", "ManagerModel", {
                        ManagerID: this.LoginModel.getProperty("/EmployeeID")
                    });
                }

                const from = oEvent.getParameter("arguments").from;

                (from !== "Tilepage") ? this._isClearPressed = true: this._isClearPressed = false

                // Clear filters if coming from main screen
                if (from === "Tilepage") {
                    const filterItems = this.byId("All_id_FilterBar").getFilterGroupItems();

                    filterItems.forEach(item => {
                        const control = item.getControl();
                        if (!control) return;

                        // Input / ComboBox
                        if (control.setValue) control.setValue("");

                        // Select / ComboBox
                        if (control.setSelectedKey) control.setSelectedKey("");

                        // MultiComboBox
                        if (control.setSelectedKeys) control.setSelectedKeys([]);

                        // DateRangeSelection
                        if (control.setDateValue && control.setSecondDateValue) {
                            control.setDateValue(null);
                            control.setSecondDateValue(null);
                        }
                    });
                }

                //  Financial Year Logic (same as Expense)
                const currentYear = new Date().getFullYear();
                let fyStart, fyEnd;

                if (new Date().getMonth() >= 3) {
                    fyStart = new Date(currentYear, 3, 1); // April 1
                    fyEnd = new Date(currentYear + 1, 2, 31); // March 31 next year
                } else {
                    fyStart = new Date(currentYear - 1, 3, 1); // April 1 last year
                    fyEnd = new Date(currentYear, 2, 31); // March 31 this year
                }

                //  ViewModel (avoid overwrite if already exists)
                if (!this.getOwnerComponent().getModel("viewModel")) {
                    var View = new JSONModel({
                        SaveBtn: false,
                        SubmitBtn: false,
                        required: true,
                        minDate: new Date(),
                        // finacialStart: fyStart,
                        // finacialEnd: fyEnd
                    });
                    this.getOwnerComponent().setModel(View, "viewModel");
                }

                this.ViewModel = this.getOwnerComponent().getModel("viewModel");

                this.i18nModel = this.getView().getModel("i18n").getResourceBundle();
                this.CommonModel();
                this.getView().getModel("LoginModel").setProperty("/HeaderName", "Allowance Application");

                if (from !== "Allowancedetails") {
                    this.onClearAndSearch("All_id_FilterBar")

                    const currentYear = new Date().getFullYear();
                    let fyStart, fyEnd;
                    if (new Date().getMonth() >= 3) {
                        fyStart = new Date(currentYear, 3, 1); // April 1
                        fyEnd = new Date(currentYear + 1, 2, 31); // March 31 next year
                    } else {
                        fyStart = new Date(currentYear - 1, 3, 1); // April 1 last year
                        fyEnd = new Date(currentYear, 2, 31); // March 31 this year
                    }
                    const dateRangeControl = this.byId("All_id_InvoiceDatePicker"); // Set the date range UI
                    if (dateRangeControl) {
                        dateRangeControl.setDateValue(fyStart);
                        dateRangeControl.setSecondDateValue(fyEnd);
                    }
                }

                const loginModel = this.getOwnerComponent().getModel("LoginModel");
                this.userId = loginModel.getProperty("/EmployeeID");
                this.onChangeEmployeeID();
                this.Exp_onSearch();
                this.onSearchAllowanceType();
                this.EmployeeDetReadCall("EmployeeDetails", {
                    EmployeeID: this.userId
                });
            } catch (error) {
                this.closeBusyDialog();
                MessageToast.show(error.message || error.responseText);
            } finally {
                this.closeBusyDialog();
            }
            this.initializeBirthdayCarousel();
        },

        // Function to fetch employee details
        EmployeeDetReadCall: async function(entity, value) {
            try {
                let data = await this.ajaxReadWithJQuery(entity, value);

                if (data && data.data && data.data.length > 0) {

                    // Format: DD/MM/YYYY → Date Object
                    let sJoiningDate = this.Formatter.formatDate(data.data[0].JoiningDate);
                    let aParts = sJoiningDate.split("/");

                    this.JoiningDateObj = new Date(
                        aParts[2], // Year
                        aParts[1] - 1, // Month (0-based)
                        aParts[0] // Day
                    );

                } else {
                    MessageToast.show(this.i18nModel.getText("joiningDateMissing"));
                }

            } catch (error) {
                MessageToast.show(error.message || error.responseText);
            }
        },

        onSearchAllowanceType: function() {
            return new Promise((resolve, reject) => {

                var filter = {
                    EmployeeID: this.LoginModel.getProperty("/EmployeeID")
                };

                this.ajaxReadWithJQuery("AllowanceFilteredData", filter)
                    .then((oData) => {
                        var aData = Array.isArray(oData.filteredData) ?
                            oData.filteredData : [oData.filteredData];

                        this.getView().setModel(
                            new sap.ui.model.json.JSONModel(aData),
                            "AllowanceType"
                        );

                    }).catch((err) => {
                        MessageToast.show(err.responseText || "Failed to Load Customer Data.");
                        this.closeBusyDialog()
                    })
            });
        },

        _getDayName: function(oDate) {
            const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            return days[oDate.getDay()];
        },

        _updateDateList: function(iMonth, iYear) {
            var iLastDay = new Date(iYear, iMonth + 1, 0).getDate();
            var aDates = [];
            for (var d = 1; d <= iLastDay; d++) {
                var oDate = new Date(iYear, iMonth, d); // Format date as dd/MM/yyyy
                var sDay = String(oDate.getDate()).padStart(2, "0");
                var sMonth = String(oDate.getMonth() + 1).padStart(2, "0");
                var sYear = oDate.getFullYear();
                var sFormatted = `${sDay}/${sMonth}/${sYear}`;
                var sWeekday = this._getDayName(oDate);
                aDates.push({
                    key: sFormatted, // unique key
                    day: sFormatted, // display text
                    weekday: sWeekday //  added field
                });
            }
            this.getView().getModel().setProperty("/dates", aDates);
        },

        _setAllowanceDates: function(iMonth, iYear) {
            var oStartDate = new Date(iYear, iMonth, 1);
            var sStartDay = String(oStartDate.getDate()).padStart(2, "0");
            var sStartMonth = String(oStartDate.getMonth() + 1).padStart(2, "0");
            var sStartYear = oStartDate.getFullYear();
            var sAllowanceStartDate = `${sStartDay}/${sStartMonth}/${sStartYear}`;

            var oEndDate = new Date(iYear, iMonth + 1, 0);
            var sEndDay = String(oEndDate.getDate()).padStart(2, "0");
            var sEndMonth = String(oEndDate.getMonth() + 1).padStart(2, "0");
            var sEndYear = oEndDate.getFullYear();
            var sAllowanceEndDate = `${sEndDay}/${sEndMonth}/${sEndYear}`;

            var oCreateModel = this.getOwnerComponent().getModel("CreateAllowanceModel");
            if (oCreateModel) {
                oCreateModel.setProperty("/AllowanceStartDate", sAllowanceStartDate);
                oCreateModel.setProperty("/AllowanceEndDate", sAllowanceEndDate);
            }
        },

        onMonthChange: function() {
            var oMonthSelect = sap.ui.getCore().byId("monthSelect");
            var oYearSelect = sap.ui.getCore().byId("yearSelect");
            var oDateMultiBox = sap.ui.getCore().byId("dateMultiBox");

            var iMonth = parseInt(oMonthSelect.getSelectedKey()); // 0-based month
            var iYear = parseInt(oYearSelect.getSelectedKey());

            if (isNaN(iMonth) || isNaN(iYear)) {
                return; // user hasn't selected both yet
            }

            oDateMultiBox.setSelectedKeys([]);

            // ---------- Allowance Start & End Date ----------
            var oStartDate = new Date(iYear, iMonth, 1); // Start of month
            var sStartDay = String(oStartDate.getDate()).padStart(2, "0");
            var sStartMonth = String(oStartDate.getMonth() + 1).padStart(2, "0");
            var sStartYear = oStartDate.getFullYear();
            var sAllowanceStartDate = `${sStartDay}/${sStartMonth}/${sStartYear}`;

            // End of month
            var oEndDate = new Date(iYear, iMonth + 1, 0);
            var sEndDay = String(oEndDate.getDate()).padStart(2, "0");
            var sEndMonth = String(oEndDate.getMonth() + 1).padStart(2, "0");
            var sEndYear = oEndDate.getFullYear();
            var sAllowanceEndDate = `${sEndDay}/${sEndMonth}/${sEndYear}`;

            // Update CreateAllowanceModel
            var oCreateModel = this.getOwnerComponent().getModel("CreateAllowanceModel");
            if (oCreateModel) {
                oCreateModel.setProperty("/AllowanceStartDate", sAllowanceStartDate);
                oCreateModel.setProperty("/AllowanceEndDate", sAllowanceEndDate);
            }

            // ---------- Populate Dates into MultiComboBox ----------
            var daysInMonth = oEndDate.getDate();
            var aDates = [];
            for (var day = 1; day <= daysInMonth; day++) {
                let oDate = new Date(iYear, iMonth, day); //  added for weekday
                let dayStr = day.toString().padStart(2, "0");
                let monthStr = (iMonth + 1).toString().padStart(2, "0");
                let fullDate = `${dayStr}/${monthStr}/${iYear}`; // dd/MM/yyyy
                let sWeekday = this._getDayName(oDate);
                aDates.push({
                    key: fullDate,
                    day: fullDate,
                    weekday: sWeekday
                });
            }

            var oModel = new sap.ui.model.json.JSONModel({
                dates: aDates
            });
            oDateMultiBox.setModel(oModel);
        },

        _initCurrentMonthData: function() {
            var today = new Date();
            var iMonth = today.getMonth(); // 0–11
            var iYear = today.getFullYear();

            var core = sap.ui.getCore();
            var oMonthSelect = core.byId("monthSelect");
            var oYearSelect = core.byId("yearSelect");
            var oDateMultiBox = core.byId("dateMultiBox");

            // Preselect current month & year
            if (oMonthSelect) oMonthSelect.setSelectedKey(iMonth.toString());
            if (oYearSelect) oYearSelect.setSelectedKey(iYear.toString());

            // Set start & end date in model
            this._setAllowanceDates(iMonth, iYear);
            var iLastDay = new Date(iYear, iMonth + 1, 0).getDate();
            var aDates = [];
            for (var d = 1; d <= iLastDay; d++) {
                var oDate = new Date(iYear, iMonth, d);
                var sDay = String(d).padStart(2, "0");
                var sMonth = String(iMonth + 1).padStart(2, "0");
                var sYear = iYear;
                var sFormatted = `${sDay}/${sMonth}/${sYear}`;
                var sWeekday = this._getDayName(oDate);
                aDates.push({
                    key: sFormatted,
                    day: sFormatted,
                    weekday: sWeekday
                })
            }

            if (oDateMultiBox) {
                var oModel = new sap.ui.model.json.JSONModel({
                    dates: aDates
                });
                oDateMultiBox.setModel(oModel);
                oDateMultiBox.bindItems({
                    path: "/dates",
                    template: new sap.ui.core.ListItem({
                        key: "{key}",
                        text: "{day}",
                        additionalText: "{weekday}"
                    })
                });
            }
        },

        onSelectdate: function(oEvent) {
            var oMultiComboBox = oEvent.getSource();

            setTimeout(() => {
                var aSelectedKeys = oMultiComboBox.getSelectedKeys();

                if (aSelectedKeys.length > 0) {
                    oMultiComboBox.setValueState("None");
                } else {
                    oMultiComboBox.setValueState("Error");
                    oMultiComboBox.setValueStateText(this.i18nModel.getText("selectDate"));
                }
            }, 0);
        },

        onSelectDatesWithoutWeekends: function() {
            var oDateMultiBox = sap.ui.getCore().byId("dateMultiBox");
            var oModel = oDateMultiBox.getModel();
            var aDates = oModel ? oModel.getProperty("/dates") : [];

            var aWeekdayKeys = aDates
                .filter(d => d.weekday !== "Saturday" && d.weekday !== "Sunday")
                .map(d => d.key);

            oDateMultiBox.setSelectedKeys(aWeekdayKeys);
            if (aWeekdayKeys.length > 0) {
                oDateMultiBox.setValueState("None");
            } else {
                oDateMultiBox.setValueState("Error");
                oDateMultiBox.setValueStateText(this.i18nModel.getText("selectDate"));
            }
        },

        onTableSelectionChange: function(oEvent) {
            var Status = oEvent.getSource().getSelectedItem().getBindingContext("AllowanceModel").getObject().Status;
            this.DeleteAllowanceID = oEvent.getSource().getSelectedItem().getBindingContext("AllowanceModel").getObject().AllowanceID;
            if (Status === "Draft") {
                this.byId("All_id_DeleteBtn").setEnabled(true);
            } else {
                this.byId("All_id_DeleteBtn").setEnabled(false);
            }
        },

        onChangeEmployeeID: async function(params) {
            var selectedItem = this.byId("All_id_EmployeeName").getSelectedItem();
            var EmployeeID = selectedItem ? selectedItem.getText() : this.LoginModel.getProperty("/EmployeeID");
            if (params && params.EmployeeID) { // Override EmployeeID if params are passed
                EmployeeID = params.EmployeeID;
            }
            const fetchParams = {
                EmployeeID: EmployeeID
            };
            if (params?.AllowanceStartDate && params?.AllowanceEndDate) {
                fetchParams.AllowanceStartDate = params.AllowanceStartDate;
                fetchParams.AllowanceEndDate = params.AllowanceEndDate;
            }
            await this._fetchCommonData("Allowance", "FilterAllowanceModel", fetchParams);
        },

        // Function to initialize the common model for expense creation
        CommonModel: function() {
            var oModel = new JSONModel({
                EmployeeID: this.LoginModel.getProperty("/EmployeeID"),
                EmployeeName: this.LoginModel.getProperty("/EmployeeName"),
                AllowanceDescription: "",
                Dates: "",
                AllowanceType: "",
                CostCenter: "Kvriksha Technologies Private Limited Kalaburagi",
                AllowanceData: "",
                Comments: "",
                Status: "Draft",
                AllowanceStartDate: "",
                AllowanceEndDate: "",
                paymentStatus: "Unpaid"
            });
            this.getOwnerComponent().setModel(oModel, "CreateAllowanceModel");
        },

        // Navigate back to the tile page
        onPressback: function() {
            this.getRouter().navTo("RouteTilePage");
        },

        onLogout: function() {
            this.CommonLogoutFunction();
        },

        // Open the "Add Expense" fragment
        Exp_onPressAddExpense: function() {
            this.CommonModel();
            if (this.Expense) {
                this.Expense.destroy();
                this.Expense = null;
            }
            var oView = this.getView();
            if (!this.Expense) {
                this.Expense = sap.ui.core.Fragment.load({
                    name: "sap.kt.com.minihrsolution.fragment.AddAllowance",
                    controller: this
                }).then(function(Expense) {
                    this.Expense = Expense;
                    oView.addDependent(this.Expense);
                    this._initCurrentMonthData();
                    var oDateMultiBox = sap.ui.getCore().byId("dateMultiBox");
                    if (oDateMultiBox) {
                        oDateMultiBox.removeAllSelectedItems();
                    }
                    this.Expense.open();
                }.bind(this));
            } else {
                this._initCurrentMonthData();
                this.Expense.open();
                var oDateMultiBox = sap.ui.getCore().byId("dateMultiBox");
                if (oDateMultiBox) {
                    oDateMultiBox.removeAllSelectedItems();
                }
            }
        },

        // Close the "Add Expense" fragment and reset validation states
        Exp_Frg_onPressClose: function() {
            this.Expense.close();
            var core = sap.ui.getCore();
            var oDateMultiBox = core.byId("dateMultiBox"); // Clear dates on close
            if (oDateMultiBox) {
                oDateMultiBox.removeAllSelectedItems();
            }
            if (this.Expense) {
                this.Expense.destroy();
                this.Expense = null;
            }
            // core.byId("All_id_AllowanceName").setValueState("None");
            // core.byId("monthSelect").setValueState("None");
            // core.byId("yearSelect").setValueState("None");
            // core.byId("dateMultiBox").setValueState("None");
            core.byId("All_id_ExpenseType").setValueState("None");
            core.byId("All_id_EmployeeRemark").setValueState("None");
        },

        // Submit the expense after validation
        Exp_Frg_onPressSubmit: async function() {
            var that = this;
            try {
                const isValid =
                    utils._LCstrictValidationComboBox(sap.ui.getCore().byId("All_id_TravelAllowance"), "ID") &&
                    this._LCvalidateMultiComboBox(sap.ui.getCore().byId("dateMultiBox")) &&
                    utils._LCstrictValidationComboBox(sap.ui.getCore().byId("All_id_ExpenseType"), "ID") &&
                    utils._LCvalidateMandatoryField(sap.ui.getCore().byId("All_id_EmployeeRemark"), "ID");

                if (!isValid) {
                    return MessageToast.show(this.i18nModel.getText("mandetoryFields"));
                }

                // Get selected dates
                var aSelectedDates = sap.ui.getCore().byId("dateMultiBox").getSelectedKeys();

                let today = new Date();
                let year = today.getFullYear();

                let AllowanceStartDate, AllowanceEndDate;

                // Financial Year Calculation (Apr → Mar)
                if (today.getMonth() + 1 < 4) {
                    AllowanceStartDate = new Date(year - 1, 3, 1); // Apr last year
                    AllowanceEndDate = new Date(year, 2, 31); // Mar current year
                } else {
                    AllowanceStartDate = new Date(year, 3, 1); // Apr current year
                    AllowanceEndDate = new Date(year + 1, 2, 31); // Mar next year
                }

                const dateRangeControl = this.byId("All_id_InvoiceDatePicker");
                if (dateRangeControl) {
                    dateRangeControl.setDateValue(AllowanceStartDate);
                    dateRangeControl.setSecondDateValue(AllowanceEndDate);
                }

                var View = new JSONModel({
                    SaveBtn: false,
                    SubmitBtn: false,
                    required: true,
                    minDate: new Date(),
                    finacialStart: AllowanceStartDate,
                    finacialEnd: AllowanceEndDate
                });

                this.getOwnerComponent().setModel(View, "viewModel");
                this.ViewModel = this.getView().getModel("viewModel");

                const oFinStart = this.ViewModel.getProperty("/finacialStart");
                const oFinEnd = this.ViewModel.getProperty("/finacialEnd");
                const oJoiningDate = this.JoiningDateObj;

                if (!oJoiningDate) {
                    return MessageToast.show("Joining date not available");
                }

                let isDateValid = true;

                const currentMonth = today.getMonth(); // 0 = Jan, 3 = April
                const currentYear = today.getFullYear();

                for (let i = 0; i < aSelectedDates.length; i++) {

                    const aParts = aSelectedDates[i].split("/");

                    const oDate = new Date(
                        aParts[2],
                        aParts[1] - 1,
                        aParts[0]
                    );

                    // Rule 1: Before Joining Date
                    if (oDate < oJoiningDate) {
                        MessageToast.show("You cannot apply allowance before your joining date");
                        isDateValid = false;
                        break;
                    }

                    const isWithinFY = oDate >= oFinStart && oDate <= oFinEnd;

                    // Grace Logic
                    const isApril = currentMonth === 3;

                    const isPrevMarch =
                        oDate.getMonth() === 2 && // March
                        oDate.getFullYear() === (currentYear);

                    // FINAL RULE
                    if (!(isWithinFY || (isApril && isPrevMarch))) {
                        MessageToast.show("You can apply allowance only for current financial year");
                        isDateValid = false;
                        break;
                    }
                }

                if (!isDateValid) {
                    return;
                }

                // Prepare payload
                const oModel = this.getView().getModel("CreateAllowanceModel").getData();

                oModel.AllowanceStartDate = oModel.AllowanceStartDate.split("/").reverse().join("-");
                oModel.AllowanceEndDate = oModel.AllowanceEndDate.split("/").reverse().join("-");
                oModel.Dates = aSelectedDates;

                this.getBusyDialog();

                const oResponse = await that.ajaxCreateWithJQuery("Allowance", {
                    data: oModel
                });

                if (oResponse) {
                    that.Expense.close();
                    // that.Exp_onPressClear();

                    await that._fetchCommonData("AllowanceTotalCalculation", "", {
                        AllowanceID: oResponse.AllowanceID,
                        EmployeeID: this.LoginModel.getProperty("/EmployeeID"),
                    });

                    this.closeBusyDialog();
                    that._isClearPressed = false
                    that.onChangeEmployeeID();
                    await that.Exp_onSearch();

                    var oDateMultiBox = sap.ui.getCore().byId("dateMultiBox");
                    if (oDateMultiBox) {
                        oDateMultiBox.removeAllSelectedItems();
                    }

                    if (this.Expense) {
                        this.Expense.destroy();
                        this.Expense = null;
                    }

                    MessageToast.show(that.i18nModel.getText("allowanceCreatedMess"));
                } else {
                    MessageToast.show(that.i18nModel.getText("allowanceCreatedMessFailed"));
                }

            } catch (oError) {
                MessageToast.show(that.i18nModel.getText("allowanceCreatedMessFailed"));
            } finally {
                this.closeBusyDialog();
            }
        },

        Exp_onCheckExpenseDetails: function(oEvent) {
            var AllowanceID = oEvent.getSource().getBindingContext("AllowanceModel").getObject().AllowanceID;
            this.getRouter().navTo("RouteAllowanceDetails", {
                sPath: AllowanceID.replaceAll("/", "")
            });
        },

        Exp_onLiveExpenseName: function(oEvent) {
            utils._LCvalidateMandatoryField(oEvent, "oEvent");
        },

        _LCvalidateMultiComboBox: function(oMultiComboBox) {
            if (!oMultiComboBox) return false;
            var aSelectedKeys = oMultiComboBox.getSelectedKeys();
            if (!aSelectedKeys || aSelectedKeys.length === 0) {
                oMultiComboBox.setValueState("Error");
                oMultiComboBox.setValueStateText(this.i18nModel.getText("selectDate")); // from i18n
                return false;
            }
            oMultiComboBox.setValueState("None");
            return true;
        },

        Exp_onChangeEmployeeRemark: function(oEvent) {
            utils._LCvalidateMandatoryField(oEvent, "oEvent");
        },

        // Delete the Expenase and Expense Item
        Exp_onPressDeleteExpense: async function(oEvent) {
            var that = this;
            var oTable = that.byId("All_id_Expense");
            this.showConfirmationDialog(
                this.i18nModel.getText("msgBoxConfirm"),
                this.i18nModel.getText("commonMesBoxConfirmDeleteAllowance"),
                async function() {
                        that.getBusyDialog();
                        try {
                            await that.ajaxDeleteWithJQuery("Allowance", {
                                filters: {
                                    AllowanceID: that.DeleteAllowanceID
                                }
                            });
                            MessageToast.show(that.i18nModel.getText("allowanceDeleteMess")); // <== use 'that' instead of 'this'
                            that.onChangeEmployeeID();
                            that.Exp_onSearch();
                            that.byId("All_id_DeleteBtn").setEnabled(false);
                            oTable.removeSelections(true);
                        } catch (error) {
                            MessageToast.show(error.responseText || "Error deleting allowance");
                            that.byId("All_id_DeleteBtn").setEnabled(false);
                            oTable.removeSelections(true);
                        } finally {
                            that.closeBusyDialog();
                            that.byId("All_id_DeleteBtn").setEnabled(false);
                            oTable.removeSelections(true);
                        }
                    },
                    function() {
                        that.closeBusyDialog();
                        that.byId("All_id_DeleteBtn").setEnabled(false);
                        oTable.removeSelections(true);
                    })
        },

        //Filter Function
        Exp_onSearch: async function() {
            try {
                this.getBusyDialog();

                var oTable = this.getView().byId("All_id_Expense");
                oTable.setEnableBusyIndicator(true);

                const aFilterItems = this.byId("All_id_FilterBar").getFilterGroupItems();

                const params = {
                    EmployeeID: this.LoginModel.getProperty("/EmployeeID")
                };

                // DateRangeSelection control
                const dateRangeControl = this.byId("All_id_InvoiceDatePicker");

                let startDate = dateRangeControl?.getDateValue();
                let endDate = dateRangeControl?.getSecondDateValue();

                let dateRangeProvided = !!(startDate && endDate);

                aFilterItems.forEach((oItem) => {
                    const oControl = oItem.getControl();
                    const sKey = oItem.getName();

                    // Skip date field since handled separately
                    if (sKey === "AllowanceDate") return;

                    if (oControl && typeof oControl.getValue === "function") {
                        const sValue = oControl.getValue().trim();
                        if (sValue) {
                            params[sKey] = sValue;
                        }
                    }
                });

                // Format date YYYY-MM-DD
                const formatDate = (date) => date.toISOString().split("T")[0];

                params.AllowanceStartDate = startDate ? formatDate(startDate) : "";
                params.AllowanceEndDate = endDate ? formatDate(endDate) : "";

                this._isManualSearch = true;

                await this._fetchCommonData(
                    "Allowance",
                    "AllowanceModel",
                    params,
                    ["All_id_Expense"]
                );

                this.onChangeEmployeeID(params);
                this.closeBusyDialog();

            } catch (error) {
                this.closeBusyDialog();
                sap.m.MessageToast.show(
                    this.i18nModel.getText("commonErrorMessage")
                );
            }
        },

        Exp_onPressClear: async function() {
            this.byId("All_id_EmployeeName").setSelectedKey("");
            this.byId("All_id_StatusFilter").setSelectedKey("");
            this.byId("All_id_InvoiceDatePicker").setValue("");
            this._isClearPressed = true;
        },

        Exp_onChangeExpenseType: function(oEvent) {
            if (oEvent.getSource()._getSelectedItemText() !== 'Customer Facing') {
                this.ViewModel.setProperty("/required", false);
            } else {
                this.ViewModel.setProperty("/required", true);
            }
            utils._LCstrictValidationComboBox(oEvent.getSource(), "ID");
        },

        getGroupHeader: function(oGroup) {
            return this.getStyledGroupHeader(oGroup);
        },

        exp_validateTravelAllownce: function(oEvent) {
            utils._LCstrictValidationComboBox(oEvent.getSource(), "ID");
        },

        onAllowanceTypeChange: function(oEvent) {
            var sSelectedType = oEvent.getSource().getSelectedKey();
            var aData = this.getView().getModel("AllowanceType").getData();
            var oMatch = aData.find(item => item.AllowanceType === sSelectedType);

            if (oMatch) {
                var oModel = this.getView().getModel("CreateAllowanceModel");
                oModel.setProperty("/AllowanceDescription", oMatch.AllowanceDescription);
                oModel.setProperty("/AllowanceAmount", oMatch.Amount);
                oModel.setProperty("/Currency", oMatch.Currency);
            }

            utils._LCstrictValidationComboBox(oEvent.getSource(), "ID");
        }
    });
});