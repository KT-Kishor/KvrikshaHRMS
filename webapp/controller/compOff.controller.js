sap.ui.define(
    [
        "./BaseController", // Import BaseController
        "sap/ui/model/json/JSONModel", // JSON model for data handling
        "sap/m/MessageToast", // Import MessageToast for notifications
        "../utils/validation", // Custom validation utilities
        "../model/formatter", // Custom formatter functions
        "sap/m/MessageBox", //Import MessageBox for alerts/confirmations
        "sap/suite/ui/commons/Timeline", // Import Timeline for displaying comments
        "sap/suite/ui/commons/TimelineItem", //Import TimelineItem for individual comments
        "sap/ui/export/Spreadsheet",
    ],
    function(BaseController, JSONModel, MessageToast, utils, Formatter, MessageBox, Timeline, TimelineItem, Spreadsheet) {
        "use strict";

        return BaseController.extend("sap.kt.minihrsolution.controller.compOff", {
            Formatter: Formatter,
            onInit: function() {
                this.getRouter().getRoute("RouteCompOff").attachMatched(this._onRouteMatched, this);
            },

            //  Helper: Fetch and filter CompOff data
            _fetchCompOffData: async function (entityName = "InboxDetails", modelName = "LeaveModel", params = {}) {
                try {
                    let oFilter = {};

                    // Role-based filter
                    if (this.Type === "Admin") {
                        oFilter.Type = "Overtime";
                    } else {
                        oFilter.EmpID = this.userId;
                        oFilter.Type = "Overtime";
                    }

                    // Date filter
                    if (params.FromDate && params.ToDate) {
                        oFilter.FromDate = params.FromDate;
                        oFilter.ToDate = params.ToDate;
                    }

                    // Employee filter
                    if (params.empId) {
                        oFilter.EmpID = params.empId;
                    }

                    if (params.Status) {
                        oFilter.Status = params.Status;  
                    }

                    await this._fetchCommonData(entityName, modelName, oFilter);
                } catch (err) {
                    sap.m.MessageToast.show(err.message || "Error fetching Overtime data");
                    throw err;
                }
            },

            AL_onSearch: async function () {
                this.getBusyDialog();

                const oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
                    pattern: "yyyy-MM-dd"
                });

                const params = {};
                let dateRangeProvided = false;

                const oStatusCombo = this.byId("AL_id_CompOffStatusFilter");
                const oDateRange = this.byId("AL_id_compoff_DateRangeSelection");
                const oEmpInput = this.byId("AL_id_employeeFilter"); 

                //  Status 
                if (oStatusCombo && oStatusCombo.getSelectedItem()) {
                    params.Status = oStatusCombo.getSelectedItem().getText();
                }

                // Date Range
                if (oDateRange) {
                    const oFromDate = oDateRange.getDateValue();
                    const oToDate = oDateRange.getSecondDateValue();

                    if (oFromDate && oToDate) {
                        params.FromDate = oDateFormat.format(oFromDate);
                        params.ToDate = oDateFormat.format(oToDate);
                        dateRangeProvided = true;
                    }
                }

                //  Employee
                if (oEmpInput && oEmpInput.getValue()) {
                    params.empId = oEmpInput.getValue();
                }

                //  Clear logic
                if (this._isClearPressed) {
                    delete params.FromDate;
                    delete params.ToDate;
                    delete params.Status;
                    this._isClearPressed = false;
                }

                //  Default Year fallback
                else if (!dateRangeProvided) {
                    const year = new Date().getFullYear();

                    params.FromDate = `${year}-01-01`;
                    params.ToDate = `${year}-12-31`;

                    if (oDateRange) {
                        oDateRange.setDateValue(new Date(year, 0, 1));
                        oDateRange.setSecondDateValue(new Date(year, 11, 31));
                    }
                }

                try {
                    await this._fetchCompOffData("InboxDetails", "LeaveModel", params);
                } catch (error) {
                    sap.m.MessageToast.show(
                        error.message || error.responseText || "Error fetching data"
                    );
                } finally {
                    this.closeBusyDialog();
                }
            },

            _onRouteMatched: async function () {
                const oOwnerComponent = this.getOwnerComponent();
                try {
                    this.i18nModel = oOwnerComponent.getModel("i18n").getResourceBundle();
                    this.initializeBirthdayCarousel();

                    const bIsLoggedIn = await this.commonLoginFunction("compOff");
                    if (!bIsLoggedIn) return;

                    this.getBusyDialog();

                    const oLoginModel = oOwnerComponent.getModel("LoginModel");
                    this.userId = oLoginModel.getProperty("/EmployeeID");
                    this.Type = oLoginModel.getProperty("/Role");
                    this.branch = oLoginModel.getProperty("/BranchCode");
                    this.currentYear = new Date().getFullYear();
                    this.onClearAndSearch("AL_id_compofffilterbar");

                    const startDate = new Date(this.currentYear, 0, 1);
                    const endDate = new Date(this.currentYear, 11, 31);

                    const oDateRange = this.byId("AL_id_compoff_DateRangeSelection");
                    if (oDateRange) {
                        oDateRange.setDateValue(startDate);
                        oDateRange.setSecondDateValue(endDate);
                    }

                    this.byId("AL_id_compOffTableStandard").setVisible(true);
                    this.byId("AL_id_compofffilterbar").setVisible(true);
                    this._makeDatePickersReadOnly(["AL_id_compoff_DateRangeSelection"]);

                    // Employee list
                    const oData = await this.ajaxReadWithJQuery("AllLoginDetails", {});
                    let aFiltered = (oData.data || []).filter(item => item.Role !== "Contractor");

                    this.getView().setModel(new sap.ui.model.json.JSONModel(aFiltered), "Employees");

                    // Min/Max dates
                    const oToday = new Date();
                    const oMinDate = new Date(oToday);
                    oMinDate.setFullYear(oToday.getFullYear() - 1);

                    const oMaxDate = new Date(oToday);
                    oMaxDate.setFullYear(oToday.getFullYear() + 1);

                    oDateRange.setMinDate(oMinDate);
                    oDateRange.setMaxDate(oMaxDate);

                    const i18n = this.getView().getModel("i18n")?.getResourceBundle();
                    oLoginModel.setProperty("/HeaderName", i18n.getText("compoffheader"));

                    this.getView().setModel(new JSONModel({ selectedType: 1 }), "selectedModel");
                    this.getView().setModel(new JSONModel({
                        Name: "line",
                        type: "column",
                        AllStatus: "column"
                    }), "MonthlyBar");

                    this.getView().setModel(new JSONModel({
                        isAdmin: this.Type === "Admin"
                    }), "viewData");

                    await this._fetchCommonData("ListOfSateData", "HolidayModel", {
                        branchCode: this.branch
                    });

                    await this._fetchCompOffData("InboxDetails", "LeaveModel", {
                        FromDate: `${this.currentYear}-01-01`,
                        ToDate: `${this.currentYear}-12-31`
                    });
                    this._isClearPressed = false; // Reset clear flag on route match
                } catch (error) {
                    MessageToast.show(error.message || error.responseText);
                } finally {
                    this.closeBusyDialog();
                }
            },

            AL_onPressApplyLeave: function() {
                const oView = this.getView();
                const oLoginModel = this.getOwnerComponent().getModel("LoginModel");
                const loginData = oLoginModel.getData();

                const today = new Date();
                const minDate = new Date();
                minDate.setDate(minDate.getDate() - 2); // allow 2 days back

                const leaveJson = {
                    employeeID: loginData.EmployeeID,
                    employeeName: loginData.EmployeeName,
                    email: loginData.EmailID,
                    fromDate: "",
                    toDate: "",
                    NoofDays: "",
                    typeOfLeave: "Overtime",
                    Comments: "",
                    Submit: true,
                    Save: false,
                    halfDay: false,
                    MinToDate: minDate,
                    minDate: minDate,
                    maxDate: null,
                    isUpdate: false,
                };

                oView.setModel(new JSONModel(leaveJson), "LeaveTempModel");

                // Apply limits to the datepickers
                const oFromDate = sap.ui.getCore().byId("AL_id_CF_FromDate");
                const oToDate = sap.ui.getCore().byId("AL_id_CF_ToDate");
                if (oFromDate && oToDate) {
                    oFromDate.setMinDate(minDate);
                    oFromDate.setMaxDate(null);

                    oToDate.setMinDate(minDate);
                    oToDate.setMaxDate(null);
                }
                this.openLeaveDialog(oView);
            },

            AL_onPressSubmit: async function() {
                try {
                    if (utils._LCstrictValidationComboBox(sap.ui.getCore().byId("AL_id_compoff_Leavetype"), "ID") && utils._LCvalidateDate(sap.ui.getCore().byId("AL_id_CF_FromDate"), "ID") && utils._LCvalidateDate(sap.ui.getCore().byId("AL_id_CF_ToDate"), "ID") && utils._LCvalidateMandatoryField(sap.ui.getCore().byId("AL_id_CompoffComments"), "ID")) {
                        var oData = this.getView().getModel("LeaveTempModel").getData();

                        // Parse dates
                        var fromDateParts = oData.fromDate.split("/").map(Number);
                        var startDate = new Date(fromDateParts[2], fromDateParts[1] - 1, fromDateParts[0]);
                        var toDateParts = oData.toDate.split("/").map(Number);
                        var endDate = new Date(toDateParts[2], toDateParts[1] - 1, toDateParts[0]);

                        // Ensure days are valid
                        if (parseFloat(oData.NoofDays) <= 0) {
                            return MessageBox.error("Number of days must be greater than zero.");
                        }

                        // Check if leave is already applied
                        if (this.isLeaveAlreadyApplied(oData.fromDate, oData.toDate)) {
                            return MessageBox.error(this.i18nModel.getText("OvertimeleaveAlreadyApplied"));
                        }

                        // ✅ Keep current-month check (remove if not needed)
                        const currentDateNew = new Date();
                        const firstOfMonth = new Date(currentDateNew.getFullYear(), currentDateNew.getMonth(), 1);
                        const lastOfMonth = new Date(currentDateNew.getFullYear(), currentDateNew.getMonth() + 1, 0);

                        const minDateCheck = new Date();
                        minDateCheck.setHours(0, 0, 0, 0);
                        minDateCheck.setDate(minDateCheck.getDate() - 2);

                        startDate.setHours(0, 0, 0, 0);
                        endDate.setHours(0, 0, 0, 0);

                        if (startDate < minDateCheck || endDate < minDateCheck) {
                            return MessageBox.error("You can apply leave only up to 2 days before today.");
                        }

                        // Always Comp Off
                        oData.typeOfLeave = "Overtime";
                        oData.fromDate = new Date(startDate.getTime() - startDate.getTimezoneOffset() * 60000).toISOString().split("T")[0];
                        oData.toDate = new Date(endDate.getTime() - endDate.getTimezoneOffset() * 60000).toISOString().split("T")[0];
                        oData.status = "Submitted";
                        oData.halfDay = oData.halfDay.toString();

                        // Clean unnecessary props
                        delete oData.Save;
                        delete oData.Submit;
                        delete oData.MinToDate;
                        delete oData.maxDate;
                        delete oData.minDate;
                        delete oData.isUpdate;

                        this.getBusyDialog();

                        this.ajaxCreateWithJQuery("CompOff", {
                                data: oData
                            })
                            .then(async (response) => {
                                this._handleResponse(response, "compApplySubmitted");
                                this.closeBusyDialog();
                            })
                            .catch((error) => {
                                this.closeBusyDialog();
                                MessageToast.show(error.message || error.responseText);
                            });
                    } else {
                        MessageToast.show(this.i18nModel.getText("mandetoryFields"));
                    }
                } catch (error) {
                    this.closeBusyDialog();
                    MessageToast.show(error.message || error.responseText);
                }
            },

            calculateDays: function(startDate, endDate) {
                var start = this.onFormatDate(startDate);
                var end = this.onFormatDate(endDate);

                var diff = end - start;
                var totalDays = Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1; // inclusive of start + end

                return totalDays;
            },

            // Update leave button handler
            AL_onPressUpdate: function() {
                var oView = this.getView();
                var oTable = this.byId("AL_id_compOffTableStandard").getSelectedItem();
                if (!oTable) return MessageToast.show("Please select a leave row to update.");

                var oModelData = JSON.parse(JSON.stringify(oTable.getBindingContext("LeaveModel").getObject()));
                this._originalLeaveData = JSON.parse(JSON.stringify(oModelData));
                this.UpdateNoofDays = oModelData.NoofDays;
                this.previousLeaveDates = [];

                // Collect previous leave dates if needed
                let prevFrom = this.onFormatDate(this.Formatter.formatDate(oModelData.StartDate));
                let prevTo = this.onFormatDate(this.Formatter.formatDate(oModelData.EndDate));
                for (let d = new Date(prevFrom); d <= new Date(prevTo); d.setDate(d.getDate() + 1)) {
                    this.previousLeaveDates.push(d.toDateString());
                }

                // Normalize EmpComment for dialog
                let sComment = "";
                if (oModelData.EmpComment) {
                    if (Array.isArray(oModelData.EmpComment)) {
                        sComment = oModelData.EmpComment[0]?.Comment || "";
                    } else if (typeof oModelData.EmpComment === "string") {
                        sComment = oModelData.EmpComment;
                    }
                }

                // Prepare leave data for dialog model
                var leaveJson = {
                    ID: oModelData.ID,
                    employeeID: oModelData.EmpID,
                    employeeName: oModelData.EmpName,
                    email: oModelData.EmpEmailID,
                    fromDate: this.Formatter.formatDate(oModelData.StartDate),
                    toDate: this.Formatter.formatDate(oModelData.EndDate),
                    NoofDays: oModelData.NoofDays,
                    typeOfLeave: oModelData.SubType,
                    Comments: sComment,
                    Submit: false,
                    Save: true,
                    halfDay: oModelData.HalfDay === "false" ? false : true,
                    managerRemark: oModelData.ManagerRemark,
                    maxDate: null,
                    minDate: null,
                    isUpdate: true,
                };

                // Set min/max dates for current month
                const minDate = new Date();
                minDate.setDate(minDate.getDate() - 2);

                leaveJson.minDate = minDate;
                leaveJson.maxDate = null;

                // Apply limits to the datepickers directly
                const oFromDate = sap.ui.getCore().byId("AL_id_CF_FromDate");
                const oToDate = sap.ui.getCore().byId("AL_id_CF_ToDate");
                if (oFromDate && oToDate) {
                    oFromDate.setMinDate(minDate);
                    oFromDate.setMaxDate(null);
                    oToDate.setMinDate(minDate);
                    oToDate.setMaxDate(null);
                }

                // Set data into LeaveTempModel and open dialog
                var oLeaveTempModel = new JSONModel(leaveJson);
                oView.setModel(oLeaveTempModel, "LeaveTempModel");
                this.openLeaveDialog(oView);
            },

            AL_onPressSave: async function() {
                try {
                    // Safely get controls
                    const oLeaveType = sap.ui.getCore().byId("AL_id_compoff_Leavetype");
                    const oFromDate = sap.ui.getCore().byId("AL_id_CF_FromDate");
                    const oToDate = sap.ui.getCore().byId("AL_id_CF_ToDate");
                    const oComments = sap.ui.getCore().byId("AL_id_CompoffComments");

                    if (!oLeaveType || !oFromDate || !oToDate || !oComments) {
                        return MessageToast.show("Required fields are not ready yet.");
                    }

                    // Validate fields
                    if (!utils._LCstrictValidationComboBox(oLeaveType, "ID") || !utils._LCvalidateDate(oFromDate, "ID") || !utils._LCvalidateDate(oToDate, "ID") || !utils._LCvalidateMandatoryField(oComments, "ID")) {
                        return;
                    }

                    const oData = this.getView().getModel("LeaveTempModel")?.getData();
                    if (!oData) return MessageToast.show("Leave data not found.");

                    if (this.isLeaveAlreadyApplied(oData.fromDate, oData.toDate, this.previousLeaveDates)) {
                        return MessageBox.error(this.i18nModel.getText("OvertimeleaveAlreadyApplied"));
                    }

                    // Parse dates
                    const fromDateParts = (oData.fromDate || "").split("/").map(Number);
                    const toDateParts = (oData.toDate || "").split("/").map(Number);
                    if (fromDateParts.length !== 3 || toDateParts.length !== 3) return MessageToast.show("Invalid date format.");

                    const startDate = new Date(fromDateParts[2], fromDateParts[1] - 1, fromDateParts[0]);
                    const endDate = new Date(toDateParts[2], toDateParts[1] - 1, toDateParts[0]);

                    // Validate number of days
                    if (parseFloat(oData.NoofDays) <= 0) {
                        return MessageBox.error("Number of days must be greater than zero.");
                    }

                    // ✅ Keep current-month check (remove if not needed)
                    const currentDateNew = new Date();
                    const firstOfMonth = new Date(currentDateNew.getFullYear(), currentDateNew.getMonth(), 1);
                    const lastOfMonth = new Date(currentDateNew.getFullYear(), currentDateNew.getMonth() + 1, 0);

                    const minDateCheck = new Date();
                    minDateCheck.setHours(0, 0, 0, 0);
                    minDateCheck.setDate(minDateCheck.getDate() - 2);

                    startDate.setHours(0, 0, 0, 0);
                    endDate.setHours(0, 0, 0, 0);

                    if (startDate < minDateCheck || endDate < minDateCheck) {
                        return MessageBox.error("You can apply leave only up to 2 days before today.");
                    }
                    // ✅ Always Comp Off (remove quota/LOP logic)
                    oData.typeOfLeave = "Overtime";
                    oData.fromDate = new Date(startDate.getTime() - startDate.getTimezoneOffset() * 60000).toISOString().split("T")[0];
                    oData.toDate = new Date(endDate.getTime() - endDate.getTimezoneOffset() * 60000).toISOString().split("T")[0];

                    const payload = {
                        data: {
                            ID: oData.ID,
                            employeeID: oData.employeeID,
                            employeeName: oData.employeeName,
                            fromDate: oData.fromDate,
                            toDate: oData.toDate,
                            NoofDays: parseFloat(oData.NoofDays),
                            typeOfLeave: oData.typeOfLeave,
                            Comments: oData.Comments || "",
                            halfDay: oData.halfDay.toString(),
                            managerRemark: oData.managerRemark || "",
                            email: oData.email,
                        },
                        filters: {
                            ID: oData.ID
                        },
                    };

                    this.getBusyDialog();
                    const res = await this.ajaxUpdateWithJQuery("CompOff", payload);
                    this._handleResponse(res, "compoffUpdatedSuccess");
                    this.closeBusyDialog();
                    // await this._fetchCompOffData("InboxDetails", "LeaveModel", "");

                    // await this._fetchCompOffData();
                } catch (error) {
                    this.closeBusyDialog();
                    MessageToast.show(error.message || error.responseText);
                }
            },

            AL_onPressDelete: async function() {
                try {
                    var oTable = this.byId("AL_id_compOffTableStandard").getSelectedItem();
                    if (!oTable) {
                        MessageToast.show(this.i18nModel.getText("selectLeaveToDelete"));
                        return;
                    }

                    var oModelData = oTable.getBindingContext("LeaveModel").getObject();
                    var requestData = {
                        filters: {
                            ID: oModelData.ID
                        }
                    };

                    // Show confirmation dialog before delete
                    this.showConfirmationDialog(
                        this.i18nModel.getText("confirmDeleteTitle"),
                        this.i18nModel.getText("confirmDeleteMessageOvertime"),
                        async function() {
                            this.getBusyDialog(); // Show busy dialog

                            try {
                                const response = await this.ajaxDeleteWithJQuery("InboxDetails", requestData);

                                this.closeBusyDialog();

                                if (response.success === true) {
                                    MessageToast.show(this.i18nModel.getText("compoffDeletedSuccess"));
                                    this.byId("AL_id_compOffTableStandard").removeSelections(true);
                                    this.byId("AL_id_compoffUpdatebtn").setVisible(false);
                                    this.byId("AL_id_compoffDeletebtn").setVisible(false);

                                    await this._fetchCompOffData();
                                } else {
                                    MessageToast.show(response.message || response.responseText);
                                }
                            } catch (error) {
                                this.closeBusyDialog();
                                MessageToast.show(error.message || error.responseText);
                            }
                        }.bind(this) // fnOnConfirm
                    );
                } catch (error) {
                    this.closeBusyDialog();
                    MessageToast.show(error.message || error.responseText);
                }
            },
            openLeaveDialog: function(oView) {
                // Check if the dialog fragment has already been created or is in the process of being created
                if (this.pLeaveDialog) {
                    // If the promise already exists, just open the dialog once it's created
                    this.pLeaveDialog.then((oLeaveDialog) => oLeaveDialog.open());
                    return;
                }

                // Load the dialog fragment and store the promise
                this.pLeaveDialog = sap.ui.core.Fragment.load({
                    name: "sap.kt.com.minihrsolution.fragment.applyCompOff",
                    controller: this,
                }).then(
                    function(oLeaveDialog) {
                        this.oLeaveDialog = oLeaveDialog;
                        oView.addDependent(this.oLeaveDialog);
                        return this.oLeaveDialog;
                    }.bind(this)
                );

                this.pLeaveDialog.then((oLeaveDialog) => {
                    // Reset fields before opening
                    this._resetDialogFields();
                    oLeaveDialog.open();
                });
            },

            _resetDialogFields: function() {
                this._FragmentDatePickersReadOnly(["AL_id_CF_FromDate", "AL_id_CF_ToDate"]);
                sap.ui.getCore().byId("AL_id_CF_FromDate").setValueState("None");
                sap.ui.getCore().byId("AL_id_CF_ToDate").setValueState("None");
                sap.ui.getCore().byId("AL_id_CompoffComments").setValueState("None");
            },

            AL_onPressClose: function() {
                this.oLeaveDialog.close();
                this.byId("AL_id_compOffTableStandard").removeSelections(true); // Clear table selection
                this.byId("AL_id_compoffUpdatebtn").setVisible(false);
                this.byId("AL_id_compoffDeletebtn").setVisible(false);
                AL_id_CompoffComments;
                if (this._originalLeaveData) {
                    var aLeaveData = this.getView().getModel("LeaveModel").getProperty("/");
                    var iIndex = aLeaveData.findIndex((item) => item.ID === this._originalLeaveData.ID);
                    if (iIndex > -1) {
                        aLeaveData[iIndex] = JSON.parse(JSON.stringify(this._originalLeaveData));
                        this.getView().getModel("LeaveModel").setProperty("/", aLeaveData);
                    }
                    this._originalLeaveData = null;
                }
                this._resetDialogFields();
            },

            // Format date string to Date object
            onFormatDate: function(dateString) {
                var parts = dateString.split("/");
                return new Date(parts[2], parts[1] - 1, parts[0]);
            },

            AL_onChangeYears: function(oEvent) {
                this.getBusyDialog(); // Show busy dialog
                var type = this.byId("AL_id_TypeOfLeave").getSelectedItem().getText();
                var year = oEvent.getSource().getSelectedKey();
                this.BarDisplayFunction(type, year, this.userId);
                this.MonthBarDisplayFunction(type, year, this.userId);
            },

            AL_onShowEmployeeComments: async function(oEvent) {
                this.getBusyDialog();
                const response = await this.ajaxReadWithJQuery("AllComments", {
                    ApplicationName: "Overtime",
                });
                const aAllComments = response.data || [];
                this.closeBusyDialog();

                var oContext = oEvent.getSource().getBindingContext("LeaveModel");
                var oData = oContext.getObject();
                var sEmpID = oData.ID;

                var aFilteredComments = aAllComments.filter(function(oComment) {
                    return oComment.ApplicationName === "Overtime" && oComment.ID === sEmpID;
                });

                let oContent;

                if (aFilteredComments.length === 0) {
                    // Show "No Data" message
                    oContent = new sap.m.VBox({
                        alignItems: "Center",
                        justifyContent: "Center",
                        items: [new sap.m.Text({
                            text: "No Data Found",
                            design: "Bold"
                        })],
                    }).addStyleClass("sapUiSmallMargin");
                } else {
                    // Map into Timeline Items
                    var aTimelineItems = aFilteredComments
                        .slice()
                        .reverse()
                        .map(function(oComment) {
                            return new sap.suite.ui.commons.TimelineItem({
                                dateTime: Formatter.formatDate(oComment.CommentDateTime),
                                title: oComment.CommentedBy,
                                text: oComment.Comment || "No comment provided",
                                userNameClickable: false,
                                icon: "sap-icon://comment",
                            });
                        });

                    // Create Timeline
                    oContent = new sap.suite.ui.commons.Timeline({
                        showHeader: false,
                        enableBusyIndicator: false,
                        width: "100%",
                        sortOldestFirst: false,
                        enableDoubleSided: false,
                        content: aTimelineItems,
                        showHeaderBar: false,
                    });
                }

                // Dialog
                var oDialog = new sap.m.Dialog({
                    title: "Overtime Comments",
                    contentWidth: "25rem",
                    contentHeight: "15rem",
                    draggable: true,
                    resizable: true,
                    content: [oContent],
                    endButton: new sap.m.Button({
                        text: "Close",
                        type: "Transparent",
                        press: function() {
                            oDialog.close();
                            oDialog.destroy();
                        },
                    }),
                });

                oDialog.open();
            },

            onMarkCalendarDatesAndLeaves: function() {
                var that = this;
                this.oDatePicker.removeAllSpecialDates();

                // Get leave and holiday data
                var leaveRecords = that.getView().getModel("LeaveModel").getData();
                var holidays = that.getView().getModel("HolidayModel").getData();

                // Get logged-in user data
                var loginData = this.getOwnerComponent().getModel("LoginModel").getData();
                var loggedInEmpId = loginData.EmployeeID;

                // Holiday map
                var holidayMap = new Map(holidays.map(function (holiday) {
                    return [new Date(holiday.Date).toDateString(), holiday.Name];
                }));

                var appliedLeaves = [];
                var yearStart = new Date(new Date().getFullYear(), 0, 1);
                var yearEnd = new Date(new Date().getFullYear(), 11, 31);

                // Process leave records (filter for logged-in user)
                leaveRecords.forEach(function (record) {
                    if (record.Status !== "Rejected" && record.EmpID === loggedInEmpId) {

                        var fromDate = that.onFormatDate(that.Formatter.formatDate(record.StartDate));
                        var toDate = that.onFormatDate(that.Formatter.formatDate(record.EndDate));
                        if (fromDate && toDate) {
                            for (var d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
                                appliedLeaves.push({
                                    date: new Date(d),
                                    employeeId: loggedInEmpId //  using loginData here
                                });
                            }
                        }
                    }
                });

                var appliedLeavesSet = new Set(appliedLeaves.map(leave => leave.date.toDateString()));

                // Mark calendar
                for (var d = new Date(yearStart); d <= yearEnd; d.setDate(d.getDate() + 1)) {
                    var day = d.getDay();
                    var isWeekend = (day === 0 || day === 6);
                    var isAppliedLeave = appliedLeavesSet.has(d.toDateString());
                    var holidayName = holidayMap.get(d.toDateString());

                    var dateRange = new sap.ui.unified.DateTypeRange({
                        startDate: new Date(d),
                        endDate: new Date(d)
                    });

                    if (holidayName) {
                        dateRange.setType("Type04");
                        dateRange.setTooltip("Holiday : " + holidayName);
                    } else if (isWeekend) {
                        dateRange.setType("Type09");
                        dateRange.setTooltip("Weekend");
                    } else if (isAppliedLeave) {
                        dateRange.setType("Type05");
                        dateRange.setTooltip("Applied Overtime");
                    } else {
                        dateRange.setType("Type06");
                        dateRange.setTooltip("Working Day");
                    }
                    this.oDatePicker.addSpecialDate(dateRange);
                }
                that.appliedLeavesSet = appliedLeavesSet;
            },

            // Initialize calendar legend
                onInitializeLegend: function (oEvent) {
                    try {
                        sap.ui.core.BusyIndicator.show(0);
                        this.oDatePicker = oEvent.getSource();
                        if (this.oDatePicker) {
                            var oLegend = new sap.ui.unified.CalendarLegend({
                                items: [
                                    new sap.ui.unified.CalendarLegendItem({ type: "Type04", text: "Holiday" }),
                                    new sap.ui.unified.CalendarLegendItem({ type: "Type09", text: "Weekend" }),
                                    new sap.ui.unified.CalendarLegendItem({ type: "Type06", text: "Working Day" }),
                                    new sap.ui.unified.CalendarLegendItem({ type: "Type05", text: "Applied Overtime" })
                                ]
                            });
                            this.oDatePicker.setLegend(oLegend);
                            this.onMarkCalendarDatesAndLeaves();
                        }
                    } catch (error) {
                        MessageToast.show(error.message || error.responseText);
                    } finally {
                        sap.ui.core.BusyIndicator.hide();
                    }
                },

            onLiveChange: function() {
                var oLeaveModel = this.getView().getModel("LeaveTempModel");
                var sFromDate = oLeaveModel.getProperty("/fromDate");
                var sToDate = oLeaveModel.getProperty("/toDate");
                var isHalfDay = oLeaveModel.getProperty("/halfDay");

                // Yahan date ki availability check karo
                if (!sFromDate || !sToDate) {
                    oLeaveModel.setProperty("/NoofDays", "0");
                    return; // Calculation skip kar do
                }

                var LeaveModel = this.getView().getModel("LeaveModel").getData();
                var filterData = LeaveModel.filter((item) => {
                    return item.ID === oLeaveModel.getData().ID;
                });

                // Calculate business days excluding weekends and holidays
                var holidays = this.getView().getModel("HolidayModel").getData();
                var sNoofDays = this.calculateDays(sFromDate, sToDate, holidays);
                if (isHalfDay && sNoofDays > 0) {
                    sNoofDays -= 0.5;
                }

                oLeaveModel.setProperty("/NoofDays", sNoofDays.toString());
                if (filterData.length !== 0) {
                    filterData[0].NoofDays = oLeaveModel.getProperty("/NoofDays");
                }
            },

            // Calculate business days between two dates
            calculateBusinessDays: function(startDate, endDate, holidays) {
                var start = this.onFormatDate(startDate);
                var end = this.onFormatDate(endDate);
                // Create set of holiday dates
                var holidaySet = new Set(
                    holidays.map(function(holiday) {
                        var holidayDate = this.Formatter.formatDate(holiday.Date);
                        var dateObject = this.onFormatDate(holidayDate);
                        return dateObject.toDateString();
                    }, this)
                );

                var diff = end - start;
                var totalDays = Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
                var businessDays = 0;

                // Count business days (excluding weekends and holidays)
                for (var i = 0; i < totalDays; i++) {
                    var currentDate = new Date(start);
                    currentDate.setDate(start.getDate() + i);
                    var dayOfWeek = currentDate.getDay();
                    var dateString = currentDate.toDateString();

                    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(dateString)) {
                        businessDays++;
                    }
                }
                return businessDays;
            },

            onHalfDaySelect: function(oEvent) {
                var bSelected = oEvent.getParameter("selected"); // Always reliable
                var oLeaveModel = this.getView().getModel("LeaveTempModel");
                oLeaveModel.setProperty("/halfDay", bSelected); // Set updated value explicitly
                this.onLiveChange(); // Recalculate
            },

            // Check if leave is already applied for given dates
            isLeaveAlreadyApplied: function(fromDate, toDate, previousDates = []) {
                let from = this.onFormatDate(fromDate);
                let to = this.onFormatDate(toDate);

                for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
                    let dateStr = d.toDateString();
                    if (this.appliedLeavesSet.has(dateStr) && !previousDates.includes(dateStr)) {
                        return true; // Date already applied by someone else and not in original
                    }
                }
                return false;
            },

            // Validation when from date changes
            onValidation: function() {
                var oLeaveModel = this.getView().getModel("LeaveTempModel");
                var sFromDate = oLeaveModel.getProperty("/fromDate");
                sFromDate = this.onFormatDate(sFromDate);
                var oFromDate = new Date(sFromDate);
                if (!isNaN(oFromDate.getTime())) {
                    oLeaveModel.setProperty("/MinToDate", oFromDate);
                }
            },

            AL_ValidateFromDate: function(oEvent) {
                const oDate = oEvent.getSource().getDateValue();
                if (oDate) {
                    oEvent.getSource().setValueState("None");
                }
                const oFromDatePicker = sap.ui.getCore().byId("AL_id_CF_FromDate");
                const oToDatePicker = sap.ui.getCore().byId("AL_id_CF_ToDate");
                const oFromDate = oFromDatePicker.getDateValue();
                const oToDate = oToDatePicker.getDateValue();
                if (oFromDate && oToDate && oFromDate > oToDate) {
                    oToDatePicker.setDateValue(null);
                    oToDatePicker.setValue("");
                    oToDatePicker.setValueState("Error");
                    oToDatePicker.setValueStateText("From Date cannot be greater than To Date");
                    // LeaveTempModel ki toDate property ko bhi clear karo
                    this.getView().getModel("LeaveTempModel").setProperty("/toDate", null);
                    this.onValidation();
                    return false;
                }
                this.onValidation();
                this.onLiveChange();
                this.onMarkCalendarDatesAndLeaves(); // Update calendar markings
                return !!this.getView().getModel("LeaveTempModel").getProperty("/fromDate");
            },

            // Validate to date
            AL_ValidateToDate: function(oEvent) {
                const oToDatePicker = oEvent.getSource(); // DatePicker control
                const oToDate = oToDatePicker.getDateValue(); // Date object

                if (oToDate) {
                    oToDatePicker.setValueState("None"); // Clear error state
                }

                const oFromDate = sap.ui.getCore().byId("AL_id_CF_FromDate").getDateValue();
                if (!oFromDate) {
                    oToDatePicker.setDateValue(null); // Clear the ToDate if FromDate is not selected
                    oToDatePicker.setValue(""); // Also clear the text input
                    oToDatePicker.setValueState("Error");
                    oToDatePicker.setValueStateText("Please select From Date");
                    return false;
                }

                this.onLiveChange();
                this.onMarkCalendarDatesAndLeaves(); // Update calendar markings
                return !!this.getView().getModel("LeaveTempModel").getProperty("/toDate");
            },

            // Validate common fields
            AL_ValidateCommonFields: function(oEvent) {
                var oInput = oEvent.getSource();
                utils._LCvalidateMandatoryField(oEvent);
                if (oInput.getValue() === "") oInput.setValueState("None"); // Clear error state on empty input
            },

            _handleResponse: async function(response, successMessageKey) {
                if (response.success === true) {
                    MessageToast.show(this.i18nModel.getText(successMessageKey));
                    this.oLeaveDialog.close();
                    this.byId("AL_id_compOffTableStandard").removeSelections(true); // Clear table selection
                    this.byId("AL_id_compoffUpdatebtn").setVisible(false);
                    this.byId("AL_id_compoffDeletebtn").setVisible(false);
                    // Refresh leave data
                    // this.BarDisplayFunction("All In One Leave", this.currentYear, this.userId);

                    await this._fetchCompOffData("InboxDetails", "LeaveModel", {
                        FromDate: `${this.currentYear}-01-01`,
                        ToDate: `${this.currentYear}-12-31`
                    });

                } else {
                    MessageToast.show(error.message || error.responseText);
                }
            },

            // Selection change handler for leave table
            onSelectionChange: function(oEvent) {
                var oSelectedItem = oEvent.getParameter("listItem");

                var oUpdateButton = this.byId("AL_id_compoffUpdatebtn");
                var oDeleteButton = this.byId("AL_id_compoffDeletebtn");

                if (oSelectedItem) {
                    var oContext = oSelectedItem.getBindingContext("LeaveModel");
                    var sStatus = oContext.getProperty("Status"); // ⚠️ Check exact case: "Status" vs "status"

                    var bVisible = sStatus === "Submitted";

                    oUpdateButton.setVisible(bVisible);
                    oDeleteButton.setVisible(bVisible);
                } else {
                    // If no row is selected → always hide them
                    oUpdateButton.setVisible(false);
                    oDeleteButton.setVisible(false);
                }
            },

            AL_onClear: async function() {
                // Reset date range
                const oDateRange = this.byId("AL_id_compoff_DateRangeSelection");
                if (oDateRange) {
                    oDateRange.setDateValue(null);
                    oDateRange.setSecondDateValue(null);
                }

                // Reset ComboBox
                const oComboBox = this.byId("AL_id_compoff_Leavetype_fil");
                if (oComboBox) {
                    oComboBox.setSelectedKey("");
                    oComboBox.setValue(""); // clear visible text as well
                }
                this.byId("AL_id_CompOffStatusFilter").setSelectedKey("");
                this._isClearPressed = true; // Flag to indicate clear action
            },

            getGroupHeader: function(oGroup) {
                return this.getStyledGroupHeader(oGroup);
            },

            AL_ValidateLeavetype: function(oEvent) {
                utils._LCstrictValidationComboBox(oEvent.getSource(), "ID");
            },

             onPressback: function() {
                this.getRouter().navTo("RouteTilePage"); // Navigate to tile page
                this.getView().getModel("LeaveModel").setData({});
            },

            onLogout: function() {
                this.CommonLogoutFunction();
            },

            AL_DownalodTableData: function() {
                var table = this.byId("AL_id_compOffTableStandard");
                const oModelData = table.getModel("LeaveModel").getData();
                const aFormattedData = oModelData.map((item) => {
                    return {
                        ...item,
                        fromDate: Formatter.formatDate(item.fromDate),
                        toDate: Formatter.formatDate(item.toDate),
                    };
                });
                const aCols = [{
                        label: this.i18nModel.getText("fromDate"),
                        property: "fromDate",
                        type: "string"
                    },
                    {
                        label: this.i18nModel.getText("toDate"),
                        property: "toDate",
                        type: "string"
                    },
                    {
                        label: this.i18nModel.getText("noOfDays"),
                        property: "NoofDays",
                        type: "string"
                    },
                    {
                        label: this.i18nModel.getText("typeOfLeave"),
                        property: "typeOfLeave",
                        type: "string"
                    },
                    {
                        label: this.i18nModel.getText("halfDay"),
                        property: "halfDay",
                        type: "string "
                    },
                ];
                const oSettings = {
                    workbook: {
                        columns: aCols,
                        context: {
                            sheetName: this.i18nModel.getText("overtimeDetail"),
                        },
                    },
                    dataSource: aFormattedData,
                    fileName: "Overtime_Leave_Details.xlsx",
                };
                const oSheet = new Spreadsheet(oSettings);
                oSheet
                    .build()
                    .then(
                        function() {
                            MessageToast.show(this.i18nModel.getText("downloadsuccessfully"));
                        }.bind(this)
                    )
                    .finally(function() {
                        oSheet.destroy();
                    });
            },
        });
    }
);