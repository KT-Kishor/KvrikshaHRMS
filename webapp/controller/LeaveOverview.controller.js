sap.ui.define([
    "./BaseController", // Import BaseController 
    "sap/ui/model/json/JSONModel", // JSON model for data handling
    "sap/m/MessageToast", // Import MessageToast for notifications
    "../model/formatter", // Custom formatter functions
    "../utils/validation", // Custom validation utilities
    "sap/m/MessageBox", //Import MessageBox for alerts/confirmations
], function (BaseController, JSONModel, MessageToast, Formatter, utils, MessageBox) {
    "use strict";
    return BaseController.extend("sap.kt.com.minihrsolution.controller.LeaveOverview", {
        Formatter: Formatter,
        onInit: function () {
            this.getRouter().getRoute("RouteLeaveOverview").attachMatched(this._onRouteMatched, this);
        },

        onOpenMessagePopover: function (oEvent) {
            if (!this._oLegendPopover) {
                this._oLegendPopover = new sap.m.Popover({
                    title: "Leave Legend",
                    placement: "Bottom",
                    contentWidth: "250px",
                    content: new sap.m.List({
                        showSeparator: "None",
                        items: [
                            this._createLegendItem("LOP", "Loss Of Pay Leave", "red"),
                            this._createLegendItem("CompOff", "Compensatory Off", "purple"),
                            this._createLegendItem("All In One Leave", "Casual / Sick / Other Leaves", "blue"),
                            this._createLegendItem("Other Leave", "Default Leave Type", "#003366"), // Dark Blue
                            this._createLegendItem("Resource Planning", "Allocated work / planning schedule", "#ADD8E6") // Light Blue
                        ]
                    })
                });

                this.getView().addDependent(this._oLegendPopover);
            }

            this._oLegendPopover.openBy(oEvent.getSource());

        },

        _createLegendItem: function (sTitle, sDesc, sColor) {
            return new sap.m.CustomListItem({
                content: new sap.m.HBox({
                    alignItems: "Center",
                    items: [
                        new sap.ui.core.Icon({
                            src: "sap-icon://circle-task-2", // High contrast circle icon
                            color: sColor,
                            size: "1.2rem"
                        }).addStyleClass("sapUiSmallMarginBeginEnd"),
                        new sap.m.VBox({
                            items: [
                                new sap.m.Text({ text: sTitle, fontWeight: "Bold" }),
                                new sap.m.Text({ text: sDesc }).addStyleClass("sapUiTinyMarginBottom")
                            ]
                        })
                    ]
                })
            });
        },

        _onRouteMatched: async function () {
            try {
                const loginSuccess = await this.commonLoginFunction("LeaveOverview");
                if (!loginSuccess) return;
                this.getBusyDialog();
                const oViewModel = new JSONModel({
                    startDate: new Date(new Date().setHours(9, 0, 0, 0)), // Start at 9 AM
                    viewKey: "Week"
                });
                this.getView().setModel(oViewModel, "viewModel");

                // User and role info
                const loginModel = this.getOwnerComponent().getModel("LoginModel");
                this.userId = loginModel.getProperty("/EmployeeID");
                this.Type = loginModel.getProperty("/Role");
                this.currentYear = new Date().getFullYear();
                this.branch = loginModel.getProperty("/BranchCode");
                this.i18nModel = this.getView().getModel("i18n").getResourceBundle();
                loginModel.setProperty("/HeaderName", this.i18nModel.getText("leaveOverview"));

                // Fetch all active employees (no manager filter)
                const params = { EmployeeStatus: "Active" };
                await this._fetchCommonData("EmployeeDetails", "sEmployeeDetails", params);
                this.CommonReadCall();
                // Get data from models
                let employees = this.getView().getModel("sEmployeeDetails").getData();
                // const allLeaves = this.getView().getModel("LeaveModel").getData();

                // Exclude contractors
                employees = employees.filter(e => e.Role !== "Contractor");
                this.getView().getModel("sEmployeeDetails").setData(employees);

                // Filter employees based on role
                let filteredEmployees = [];
                if (this.Type === "Admin" || this.Type === "Account Manager" || this.Type === "Account Consultant") {
                    // Admin sees all active employees
                    filteredEmployees = employees;
                } else if (["Manager", "HR Manager", "IT Manager"].includes(this.Type)) {
                    // Manager sees themselves and their team
                    filteredEmployees = employees.filter(e =>
                        e.EmployeeID === this.userId || e.ManagerID === this.userId
                    );
                } else if (["Employee", "IT Consultant", "HR", "Trainee"].includes(this.Type)) {
                    // Employee sees themselves, team under same manager, their manager
                    const currentEmp = employees.find(e => e.EmployeeID === this.userId);
                    const currentManagerID = currentEmp ? currentEmp.ManagerID : null;
                    const currentBranch = currentEmp ? currentEmp.BranchCode : null;
                    filteredEmployees = employees.filter(e =>
                    (
                        e.EmployeeID === this.userId || // self
                        (e.ManagerID === currentManagerID && e.BranchCode === currentBranch) ||
                        e.EmployeeID === currentManagerID // manager
                    )
                    );
                }

                // const filteredEmpIDs = filteredEmployees.map(e => e.EmployeeID);
                // const filteredLeaves = allLeaves.filter(l => filteredEmpIDs.includes(l.employeeID));
                // const approvedLeaves = filteredLeaves.filter(l => l.status === "Approved");
                // var InboxDetailsModel = this.getView().getModel("InboxDetailsModel").getProperty("/");
                // await this._preparePlanningCalendarData(filteredEmployees, approvedLeaves, InboxDetailsModel);

                this.initializeBirthdayCarousel(); // Initialize birthday carousel
                this.closeBusyDialog();
            } catch (error) {
                this.closeBusyDialog();
                MessageToast.show(error.message || error.responseText);
            } finally {
                this.closeBusyDialog();
            }

            this.EmployeeDetReadCall("EmployeeDetails", {
                "EmployeeID": this.userId
            })
            this._fetchCommonData("ListOfSateData", "HolidayModel", {
                branchCode: this.branch
            });
            this.BarDisplayFunction("All In One Leave", this.currentYear, this.userId);
        },

        CommonReadCall: async function () {
            this.getBusyDialog();

            this._fetchCommonData("Leaves", "EmpLeaveModel", { employeeID: this.userId });
            this._fetchCommonData("Compoff", "CompoffModel", { Employee: this.userId });
            await this._fetchCommonData("Leaves", "LeaveModel", {});
            await this._fetchCommonData("InboxDetails", "InboxDetailsModel", {
                Type: "Leave",
                ResourcePlanningType: "Resource Planning"
            });

            let employees = this.getView().getModel("sEmployeeDetails").getData();
            const leaves = this.getView().getModel("LeaveModel").getData();
            let inbox = this.getView().getModel("InboxDetailsModel").getData();
            inbox = inbox.filter(item =>
                item.Status === "Submitted" || item.Status === "Rejected"
            );

            const filteredEmpIDs = employees.map(e => e.EmployeeID);
            const filteredLeaves = leaves.filter(l => filteredEmpIDs.includes(l.employeeID));
            const approvedLeaves = filteredLeaves.filter(l => l.status === "Approved");

            this._preparePlanningCalendarData(employees, approvedLeaves, inbox);
            this.closeBusyDialog();
        },

        _preparePlanningCalendarData: function (employees, leaves, InboxDetailsModel) {
            const planningData = {
                people: []
            };

            employees.forEach(employee => {

                const employeeLeaves = (leaves || []).filter(l => l.employeeID === employee.EmployeeID);

                const employeeInbox = (InboxDetailsModel || []).filter(i => i.EmpID === employee.EmployeeID);

                const initials = (employee.EmployeeName || "").split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();

                const pic = employee.ProfilePhoto ?
                    "data:image/png;base64," + employee.ProfilePhoto :
                    this._generateInitialsAvatar(initials);

                const employeeRow = {
                    pic: pic,
                    name: employee.EmployeeID,
                    role: employee.EmployeeName || "",
                    appointments: [],
                    headers: []
                };

                employeeLeaves.forEach(leave => {

                    if (!leave.fromDate || !leave.toDate) return;

                    let startDate = new Date(leave.fromDate);
                    let endDate = new Date(leave.toDate);

                    startDate.setHours(9, 0, 0, 0);
                    endDate.setHours(19, 0, 0, 0);

                    employeeRow.appointments.push({
                        start: startDate,
                        end: endDate,
                        title: "Leave",
                        info: `Days: ${leave.NoofDays || 0}`,
                        color: this._getAppointmentColor(leave.status, leave.typeOfLeave),
                        tentative: leave.status === 'Approved',
                        ID: leave.ID,
                        EmpID: leave.employeeID,
                        EmployeeName: employee.EmployeeName,
                    });
                });

                employeeInbox.forEach(item => {

                    if (!item.StartDate || !item.EndDate) return;

                    let startDate = new Date(item.StartDate);
                    let endDate = new Date(item.EndDate);

                    startDate.setHours(9, 0, 0, 0);
                    endDate.setHours(19, 0, 0, 0);

                    employeeRow.appointments.push({
                        start: startDate,
                        end: endDate,
                        title: "Resource Planning",
                        info: `Days: ${item.NoofDays || 0}`,
                        color: this._getAppointmentColor(item.status, item.SubType),
                        tentative: item.Status === "Submitted",
                        ID: item.ID,
                        EmpID: item.EmpID,
                        EmployeeName: item.EmpName,
                        Email: item.EmpEmailID,
                        Comments: item.EmpComment,
                        NoofDays: item.NoofDays,
                        TypeOfLeave: item.SubType,
                        HalfDay: item.HalfDay === 'false' ? false : true,
                        LeaveSessionType: item.leaveSessionType || "",
                    });
                });

                //  Push only once
                planningData.people.push(employeeRow);
            });

            this.getView().setModel(new sap.ui.model.json.JSONModel(planningData), "PlanningModel");
        },

        _generateInitialsAvatar: function (initials) {
            const canvas = document.createElement("canvas");
            canvas.width = 64;
            canvas.height = 64;
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#6A6AF4"; // Circle background
            ctx.beginPath();
            ctx.arc(32, 32, 32, 0, Math.PI * 2);
            ctx.fill();
            ctx.font = "bold 24px Arial"; // Initials
            ctx.fillStyle = "white";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(initials, 32, 35);
            return canvas.toDataURL("image/png");
        },

        handleAppointmentSelect: function (oEvent) {

            const oAppointment = oEvent.getParameter("appointment");
            const aAppointments = oEvent.getParameter("appointments");

            if (oAppointment) {

                const oAppData = oAppointment.getBindingContext("PlanningModel").getObject();

                const sLeaveID = oAppData.ID || "";
                const sTitle = oAppData.typeOfLeave || oAppData.type || "Leave";
                const sInfo = oAppData.info || "";
                const sEmpName = oAppData.EmployeeName || oAppData.EmpName || "N/A";

                const sFrom = this.Formatter.formatDate(oAppData.start);
                const sTo = this.Formatter.formatDate(oAppData.end);

                const isManager = ["Manager", "HR Manager", "Account Manager", "IT Manager"].includes(this.Type);
                const isAdmin = this.Type === "Admin";
                const isOwnLeave = oAppData.EmpID === this.userId;

                const isResourcePlanning = oAppData.title === "Resource Planning";

                let aActions = [];

                // ORDER: Update → Dashboard → Delete → Close

                if (isResourcePlanning) {
                    //  Update for OWN leave (Employee + Manager + Admin)
                    if (isOwnLeave) {
                        aActions.push("Update");
                    }
                }

                //  Dashboard for Manager/Admin (any leave)
                if (!isResourcePlanning && (isManager || isAdmin)) {
                    aActions.push("Dashboard");
                }

                //  Delete only for Resource Planning (own)
                if (isResourcePlanning && oAppData.EmpID === this.userId) {
                    aActions.push("Delete");
                }

                //  Always last
                aActions.push(sap.m.MessageBox.Action.CLOSE);

                sap.m.MessageBox.success(
                    "Name: " + sEmpName +
                    "\nType: " + sTitle +
                    "\nFrom: " + sFrom + " - " + sTo +
                    "\n" + sInfo, {
                    title: isResourcePlanning ? "Resource Planning Details" : "Leave Details",
                    actions: aActions,

                    //  Highlight first meaningful action
                    emphasizedAction: aActions.length > 1 ? aActions[0] : sap.m.MessageBox.Action.CLOSE,

                    onClose: function (sAction) {

                        //  Update
                        if (sAction === "Update") {
                            this._openUpdateFromCalendar(oAppData);
                        }

                        //  Dashboard
                        if (sAction === "Dashboard" && sLeaveID && (isManager || isAdmin)) {
                            this.getOwnerComponent().setModel(
                                new sap.ui.model.json.JSONModel({
                                    from: "LeaveOverview"
                                }),
                                "NavSource"
                            );

                            this.getRouter().navTo("RouteDetailLeave", {
                                sLeaveID: sLeaveID
                            });
                        }

                        //  Delete
                        if (sAction === "Delete" && isResourcePlanning) {
                            this._deleteResourcePlanning(sLeaveID);
                        }

                    }.bind(this)
                }
                );

                return;
            }

            //  Multiple selection case
            if (Array.isArray(aAppointments) && aAppointments.length > 0) {

                const summaries = aAppointments.map(function (a) {
                    const oAppData = a.getBindingContext("PlanningModel").getObject();

                    return "Name: " + (oAppData.EmployeeName || oAppData.EmpName || "N/A") +
                        "\nType: " + (oAppData.type || oAppData.typeOfLeave) +
                        "\nFrom: " + oAppData.start +
                        " - " + oAppData.end +
                        "\n" + (oAppData.info || "");
                });

                sap.m.MessageBox.success(summaries.join("\n\n"), {
                    title: "Details"
                });
            }
        },

        _deleteResourcePlanning: async function (sValue) {
            try {
                var requestData = {
                    filters: {
                        ID: sValue
                    }
                };

                this.showConfirmationDialog(
                    this.i18nModel.getText("confirmDeleteTitle"),
                    this.i18nModel.getText("confirmDeleteMessageResource"),
                    async function () {
                        this.getBusyDialog();
                        try {
                            const response = await this.ajaxDeleteWithJQuery("InboxDetails", requestData);

                            if (response.success === true) {
                                MessageToast.show(this.i18nModel.getText("ResourceDeletedSuccess"));
                                this.CommonReadCall(); // refresh
                            } else {
                                MessageToast.show(response.message || response.responseText);
                            }

                        } catch (error) {
                            MessageToast.show(error.message || error.responseText);
                        } finally {
                            this.closeBusyDialog();
                        }
                    }.bind(this)
                );

            } catch (error) {
                this.closeBusyDialog();
                MessageToast.show(error.message || error.responseText);
            }
        },

        _getAppointmentColor: function (status, typeOfLeave) {
            if (status === "Approved" || status === "Submitted") {
                switch (typeOfLeave) {
                    case "LOP":
                        return "#F39C12"; // Orange
                    case "CompOff":
                        return "#8480BB"; // Violet
                    case "All In One Leave":
                        return "#54AFE6"; // Blue
                    default:
                        return "#2C3587"; // Default blue
                }
            } else if (status === "Rejected") {
                return "#E74C3C"; // Red for rejected
            }
        },

        onPressback: function() {
            this.getRouter().navTo("RouteTilePage"); // Navigate to tile page
            this.getView().getModel("LeaveModel").setData({});
            this.getView().getModel("EmpLeaveModel").setData({});
            this.getView().getModel("CompoffModel").setData({});
        },

        onLogout: function () {
            this.CommonLogoutFunction(); // Navigate to login page
        },

        AL_onPressApplyLeave: function () {
            var oView = this.getView();
            var loginData = this.getOwnerComponent().getModel("LoginModel").getData();

            var oToday = new Date();
            oToday.setHours(0, 0, 0, 0);

            // Create leave JSON model
            var leaveJson = {
                employeeID: loginData.EmployeeID,
                employeeName: loginData.EmployeeName,
                email: loginData.EmailID,
                fromDate: "",
                toDate: "",
                NoofDays: "",
                typeOfLeave: "",
                comments: "",
                Submit: true,
                Save: false,
                halfDay: false,
                leaveSessionType: "",
                MinToDate: null,
                managerRemark: "",
                maxDate: null,
                minDate: oToday,
                isUpdate: false,
            };

            var oLeaveTempModel = new JSONModel(leaveJson);
            oView.setModel(oLeaveTempModel, "LeaveTempModel");
            this.openLeaveDialog(oView);
        },

        _openUpdateFromCalendar: function (oModelData) {
            var oView = this.getView();

            // Deep copy original
            this._originalLeaveData = JSON.parse(JSON.stringify(oModelData));
            this.UpdateNoofDays = oModelData.NoofDays;

            this.previousLeaveDates = [];
            let prevFrom = new Date(oModelData.start);
            let prevTo = new Date(oModelData.end);

            prevFrom.setHours(0, 0, 0, 0);
            prevTo.setHours(0, 0, 0, 0);

            for (let d = new Date(prevFrom); d <= prevTo; d.setDate(d.getDate() + 1)) {
                this.previousLeaveDates.push(new Date(d).toDateString());
            }

            var oToday = new Date();
            oToday.setHours(0, 0, 0, 0);

            var leaveJson = {
                ID: oModelData.ID,

                employeeID: oModelData.EmpID,
                employeeName: oModelData.EmployeeName,
                email: oModelData.Email,
                fromDate: this.Formatter.formatDate(oModelData.start),
                toDate: this.Formatter.formatDate(oModelData.end),
                typeOfLeave: oModelData.TypeOfLeave,
                NoofDays: oModelData.NoofDays,
                comments: oModelData.Comments || "",
                Submit: false,
                Save: true,
                halfDay: oModelData.HalfDay === true || oModelData.HalfDay === "true",
                leaveSessionType: oModelData.LeaveSessionType || "",
                managerRemark: oModelData.ManagerRemark || "",
                maxDate: null,
                minDate: oToday,
                isUpdate: true
            };

            //  Set model
            var oLeaveTempModel = new sap.ui.model.json.JSONModel(leaveJson);
            oView.setModel(oLeaveTempModel, "LeaveTempModel");

            this.openLeaveDialog(oView);
        },

        openLeaveDialog: function (oView) {
            var oView = this.getView();
            if (this.oLeaveDialog) {
                this.oLeaveDialog.destroy();
                this.oLeaveDialog = null;
            }
            if (!this.oLeaveDialog) {
                sap.ui.core.Fragment.load({
                    name: "sap.kt.com.minihrsolution.fragment.ApplyLeave",
                    controller: this,
                }).then(function (oLeaveDialog) {
                    this.oLeaveDialog = oLeaveDialog;
                    oView.addDependent(this.oLeaveDialog);
                    this.oLeaveDialog.open();
                }.bind(this));
            } else {
                this._FragmentDatePickersReadOnly(["AL_id_FromDate", "AL_id_ToDate"]);
                sap.ui.getCore().byId("AL_id_FromDate").setValueState("None");
                sap.ui.getCore().byId("AL_id_ToDate").setValueState("None");
                sap.ui.getCore().byId("AL_id_LeaveComments").setValueState("None");
                this.oLeaveDialog.open();
            }
        },

        AL_ValidateLeavetype: function (oEvent) {
            utils._LCstrictValidationComboBox(oEvent.getSource(), "ID");
        },

        AL_ValidateFromDate: function (oEvent) {
            const oDate = oEvent.getSource().getDateValue();
            if (oDate) {
                oEvent.getSource().setValueState("None"); // Clear error state
            }
            const oFromDatePicker = sap.ui.getCore().byId("AL_id_FromDate");
            const oToDatePicker = sap.ui.getCore().byId("AL_id_ToDate");
            const oFromDate = oFromDatePicker.getDateValue(); // Date object
            const oToDate = oToDatePicker.getDateValue(); // Date object
            if (oFromDate && oToDate && oFromDate > oToDate) {
                oToDatePicker.setDateValue(null); // Clear the ToDate if FromDate is greater
                oToDatePicker.setValue("");
                oToDatePicker.setValueState("Error");
                oToDatePicker.setValueStateText("From Date cannot be greater than To Date");
                this.onValidation();
                return false;
            }
            this.onValidation();
            this.onLiveChange();
            return !!this.getView().getModel("LeaveTempModel").getProperty("/fromDate");
        },

        AL_ValidateToDate: function (oEvent) {
            const oToDatePicker = oEvent.getSource(); // DatePicker control
            const oToDate = oToDatePicker.getDateValue(); // Date object

            if (oToDate) {
                oToDatePicker.setValueState("None"); // Clear error state
            }

            const oFromDate = sap.ui.getCore().byId("AL_id_FromDate").getDateValue();
            if (!oFromDate) {
                oToDatePicker.setDateValue(null); // Clear the ToDate if FromDate is not selected
                oToDatePicker.setValue(""); // Also clear the text input
                oToDatePicker.setValueState("Error");
                oToDatePicker.setValueStateText("Please select From Date");
                return false;
            }

            this.onLiveChange();

            return !!this.getView().getModel("LeaveTempModel").getProperty("/toDate");
        },

        onLiveChange: function () {
            var oLeaveModel = this.getView().getModel("LeaveTempModel");
            var sFromDate = oLeaveModel.getProperty("/fromDate");
            var sToDate = oLeaveModel.getProperty("/toDate");
            var isHalfDay = oLeaveModel.getProperty("/halfDay");

            var LeaveModel = this.getView().getModel("EmpLeaveModel").getData();
            var filterData = LeaveModel.filter((item) => {
                return item.ID === oLeaveModel.getData().ID;
            });

            // Calculate business days excluding weekends and holidays
            var holidays = this.getView().getModel("HolidayModel").getData();
            var sNoofDays = this.calculateBusinessDays(sFromDate, sToDate, holidays);
            if (isHalfDay && sNoofDays > 0) {
                sNoofDays -= 0.5;
            }

            oLeaveModel.setProperty("/NoofDays", sNoofDays.toString());
            if (filterData.length !== 0) {
                filterData[0].NoofDays = oLeaveModel.getProperty("/NoofDays");
            }
        },

        onInitializeLegend: function (oEvent) {
            try {
                sap.ui.core.BusyIndicator.show(0);
                this.oDatePicker = oEvent.getSource();
                if (this.oDatePicker) {
                    var oLegend = new sap.ui.unified.CalendarLegend({
                        items: [
                            new sap.ui.unified.CalendarLegendItem({
                                type: "Type04",
                                text: "Holiday"
                            }),
                            new sap.ui.unified.CalendarLegendItem({
                                type: "Type09",
                                text: "Weekend"
                            }),
                            new sap.ui.unified.CalendarLegendItem({
                                type: "Type06",
                                text: "Working Day"
                            }),
                            new sap.ui.unified.CalendarLegendItem({
                                type: "Type05",
                                text: "Applied Leaves"
                            })
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

        onMarkCalendarDatesAndLeaves: function () {
            var that = this;
            this.oDatePicker.removeAllSpecialDates();

            // Get models
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
                if (record.status !== "Rejected" && record.employeeID === loggedInEmpId) {

                    var fromDate = that.onFormatDate(that.Formatter.formatDate(record.fromDate));
                    var toDate = that.onFormatDate(that.Formatter.formatDate(record.toDate));

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
                    dateRange.setTooltip("Applied Leave");
                } else {
                    dateRange.setType("Type06");
                    dateRange.setTooltip("Working Day");
                }
                this.oDatePicker.addSpecialDate(dateRange);
            }
            that.appliedLeavesSet = appliedLeavesSet;
        },

        onHalfDaySelect: function (oEvent) {
            var bSelected = oEvent.getParameter("selected");
            var oLeaveModel = this.getView().getModel("LeaveTempModel");
            oLeaveModel.setProperty("/halfDay", bSelected);

            if (!bSelected) {
                oLeaveModel.setProperty("/leaveSessionType", "");
            }
            this.onLiveChange(); // Recalculate No of Days
        },

        onChangeleasveSessionType: function (oEvent) {
            var selectedIndex = oEvent.getParameter("selectedIndex");
            var oLeaveModel = this.getView().getModel("LeaveTempModel");
            var selectedSession = selectedIndex === 0 ? "Morning" : selectedIndex === 1 ? "Afternoon" : "";
            oLeaveModel.setProperty("/leaveSessionType", selectedSession); // Set selected session in model
            // Clear value state if a session is selected
            var oRadioGroup = sap.ui.getCore().byId("AL_id_leasveSessionType");
            if (selectedSession !== "") {
                oRadioGroup.setValueState("None");
            }
        },

        AL_ValidateCommonFields: function (oEvent) {
            var oInput = oEvent.getSource();
            utils._LCvalidateMandatoryField(oEvent);
            if (oInput.getValue() === "") oInput.setValueState("None"); // Clear error state on empty input
        },

        AL_onPressSubmit: async function () {
            try {
                if (utils._LCstrictValidationComboBox(sap.ui.getCore().byId("AL_id_Leavetype"), "ID") && utils._LCvalidateDate(sap.ui.getCore().byId("AL_id_FromDate"), "ID") && utils._LCvalidateDate(sap.ui.getCore().byId("AL_id_ToDate"), "ID") && utils._LCvalidateMandatoryField(sap.ui.getCore().byId("AL_id_LeaveComments"), "ID")) {

                    var oData = this.getView().getModel("LeaveTempModel").getData();
                    var oRadioGroup = sap.ui.getCore().byId("AL_id_leasveSessionType");
                    if (JSON.parse(oData.halfDay) && (!oData.leaveSessionType || oData.leaveSessionType === "")) {
                        oRadioGroup.setValueState("Error");
                        sap.m.MessageToast.show("Please select Morning or Afternoon for Half Day leave.");
                        return; // stop submit
                    } else {
                        oRadioGroup.setValueState("None");
                    }

                    // Parse dates
                    var fromDateParts = oData.fromDate.split("/").map(Number);
                    var startDate = new Date(fromDateParts[2], fromDateParts[1] - 1, fromDateParts[0]);
                    var toDateParts = oData.toDate.split("/").map(Number);
                    var endDate = new Date(toDateParts[2], toDateParts[1] - 1, toDateParts[0]);

                    // Allow last year leave only until Jan 31 of current year
                    var currentDate = new Date();
                    var jan31 = new Date(currentDate.getFullYear(), 0, 31);
                    var isFromLastYear = fromDateParts[2] === currentDate.getFullYear() - 1;
                    var isToLastYear = toDateParts[2] === currentDate.getFullYear() - 1;
                    var isCurrentYear = fromDateParts[2] === currentDate.getFullYear() && toDateParts[2] === currentDate.getFullYear();

                    if (!(isCurrentYear || (isFromLastYear && isToLastYear && currentDate <= jan31))) return MessageBox.error(this.i18nModel.getText("leaveSameYear"));

                    if (oData.typeOfLeave === "All In One Leave") {
                        var fiveDaysBack = new Date(currentDate);
                        fiveDaysBack.setDate(currentDate.getDate() - 5);
                        if (startDate < fiveDaysBack) return MessageBox.error(this.i18nModel.getText("backdatedLeaveNotAllowed"));
                    }

                    if (oData.typeOfLeave === "CompOff") {
                        var compOffData = this.getView().getModel("CompoffModel").getData();
                        var availableQuota = 0;
                        if (Array.isArray(compOffData) && compOffData.length > 0) {
                            availableQuota = parseFloat(compOffData[0].Quota || "0");
                        } else if (compOffData && compOffData.Quota) {
                            availableQuota = parseFloat(compOffData.Quota || "0");
                        }
                        var appliedDays = parseFloat(oData.NoofDays);
                        if (appliedDays > availableQuota) return MessageBox.error("You have only " + availableQuota + " CompOff days left.");
                    }

                    // Check if leave is on holiday
                    if (oData.fromDate === oData.toDate) {
                        var isValid = true;
                        var holidays = this.getView().getModel("HolidayModel").getData();
                        holidays.forEach((holiday) => {
                            var holidayDate = new Date(holiday.Date);
                            // Normalize both dates to ensure accurate comparison
                            holidayDate.setHours(0, 0, 0, 0);
                            startDate.setHours(0, 0, 0, 0);
                            if (holidayDate.getTime() === startDate.getTime()) isValid = false;
                        });
                        if (!isValid) return MessageBox.error(this.i18nModel.getText("holidaysMess"));
                    }

                    if (parseFloat(oData.NoofDays) <= 0) return MessageBox.error(this.i18nModel.getText("holidaysMess"));

                    // Check if leave is on weekend
                    if (parseFloat(oData.NoofDays) <= 2) {
                        var isFromWeekend = (startDate.getDay() === 0 || startDate.getDay() === 6);
                        var isToWeekend = (endDate.getDay() === 0 || endDate.getDay() === 6);
                        if (isFromWeekend && isToWeekend) return MessageBox.error(this.i18nModel.getText("holidaysMess"));
                    }

                    // Check if leave is already applied
                    if (this.isLeaveAlreadyApplied(oData.fromDate, oData.toDate)) return MessageBox.error(this.i18nModel.getText("leaveAlreadyApplied"));

                    // Calculate used leaves
                    var LeaveModel = this.getView().getModel("EmpLeaveModel").getData();

                    // Filter leave data for current year
                    var filteredData = LeaveModel.filter((item) => {
                        if (item.typeOfLeave !== "All In One Leave") return false;

                        var fromDate = this.onFormatDate(this.Formatter.formatDate(item.fromDate));
                        var toDate = this.onFormatDate(this.Formatter.formatDate(item.toDate));
                        var startOfYear = new Date(this.currentYear, 0, 1);
                        var endOfYear = new Date(this.currentYear, 11, 31);

                        return fromDate >= startOfYear && toDate <= endOfYear;
                    });

                    // Exclude rejected leaves
                    filteredData = filteredData.filter((item) => item.status !== "Rejected");

                    // Calculate total leave days
                    var totalNoofDays = filteredData.reduce((total, item) => {
                        return total + parseFloat(item.NoofDays || 0);
                    }, 0);

                    totalNoofDays = totalNoofDays + parseFloat(oData.NoofDays);

                    // Check against quota
                    var oLeaveModel = this.getView().getModel("secondLeaveData");
                    var leaveData = oLeaveModel.getProperty("/chartData");

                    var quotaLeave = leaveData.find(function (leave) {
                        return leave.LeaveStatus === "All Quota";
                    });

                    if (oData.typeOfLeave === "All In One Leave") {
                        //  Get month (1–12)
                        var leaveMonth = parseInt(oData.fromDate.split('/')[1]);

                        //  Calculate leave quota
                        var monthlyQuota = Math.round((leaveMonth * 1.33) * 100) / 100;

                        //  Get leave data
                        var leaveData = oLeaveModel.getProperty("/chartData") || [];

                        var usedLeaves = leaveData
                            .filter(l =>
                                l.LeaveType === "All In One Leave" &&
                                (l.LeaveStatus === "Submitted" || l.LeaveStatus === "Approved")
                            )
                            .reduce((sum, l) => sum + parseFloat(l.Count || 0), 0);

                        //  New leave
                        var newLeave = parseFloat(oData.NoofDays || 0);

                        var projectedLeaves = usedLeaves + newLeave;

                        //  Validation
                        if (projectedLeaves > monthlyQuota) {
                            return MessageBox.error(this.i18nModel.getText("monthlyQuotatillNow"));
                        }
                    }

                    if (oData.typeOfLeave === "LOP" || totalNoofDays <= quotaLeave.Count) {
                        oData.fromDate = new Date(startDate.getTime() - startDate.getTimezoneOffset() * 60000).toISOString().split("T")[0];
                        oData.toDate = new Date(endDate.getTime() - endDate.getTimezoneOffset() * 60000).toISOString().split("T")[0];
                        oData.halfDay = oData.halfDay.toString();

                        var oDataJson = {
                            ID: this.generateUUID(),
                            ResourcePlanningType: "Resource Planning",
                            EmpID: oData.employeeID,
                            EmpName: oData.employeeName,
                            EmpEmailID: oData.email,
                            StartDate: oData.fromDate,
                            EndDate: oData.toDate,
                            status: "Submitted",
                            EmpComment: oData.comments,
                            NoofDays: oData.NoofDays,
                            HalfDay: oData.halfDay,
                            Type: "Leave",
                            SubType: oData.typeOfLeave,
                            SubmittedDate: new Date().toISOString(),
                            leaveSessionType: oData.leaveSessionType
                        }

                        this.getBusyDialog(); // Show busy dialog

                        // Submit to backend
                        this.ajaxCreateWithJQuery("InboxDetails", {
                            data: oDataJson
                        }).then(response => {
                            this.CommonReadCall(); // refresh
                            this.closeBusyDialog(); //  Close BusyDialog
                            MessageToast.show(this.i18nModel.getText("ResourcePlanningSubmitted"));
                            this.oLeaveDialog.close(); // Close dialog
                            this.oLeaveDialog.destroy(); // Destroy dialog
                            this.oLeaveDialog = null;
                        }).catch((error) => {
                            this.closeBusyDialog(); //  Close BusyDialog
                            MessageToast.show(error.message || error.responseText);
                        });
                    } else {
                        return MessageBox.error(this.i18nModel.getText("quotaExceeded"));
                    }

                } else {
                    MessageToast.show(this.i18nModel.getText("mandetoryFields"));
                }
            } catch (error) {
                this.closeBusyDialog(); //  Close BusyDialog
                MessageToast.show(error.message || error.responseText);
            }
        },

        // Save leave handler
        AL_onPressSave: async function () {
            try {
                //  Validate fields
                if (
                    utils._LCstrictValidationComboBox(sap.ui.getCore().byId("AL_id_Leavetype"), "ID") &&
                    utils._LCvalidateDate(sap.ui.getCore().byId("AL_id_FromDate"), "ID") &&
                    utils._LCvalidateDate(sap.ui.getCore().byId("AL_id_ToDate"), "ID") &&
                    utils._LCvalidateMandatoryField(sap.ui.getCore().byId("AL_id_LeaveComments"), "ID")
                ) {

                    var oData = this.getView().getModel("LeaveTempModel").getData();

                    //  Half Day Validation
                    var oRadioGroup = sap.ui.getCore().byId("AL_id_leasveSessionType");
                    if (oData.halfDay && (!oData.leaveSessionType || oData.leaveSessionType === "")) {
                        oRadioGroup.setValueState("Error");
                        sap.m.MessageToast.show("Please select Morning or Afternoon for Half Day leave.");
                        return;
                    } else {
                        oRadioGroup.setValueState("None");
                    }

                    //  Date Parsing
                    var fromDateParts = oData.fromDate.split("/").map(Number);
                    var startDate = new Date(fromDateParts[2], fromDateParts[1] - 1, fromDateParts[0]);

                    var toDateParts = oData.toDate.split("/").map(Number);
                    var endDate = new Date(toDateParts[2], toDateParts[1] - 1, toDateParts[0]);

                    var currentDate = new Date();

                    //  Same Year / Last Year Validation
                    var jan31 = new Date(currentDate.getFullYear(), 0, 31);
                    var isFromLastYear = fromDateParts[2] === currentDate.getFullYear() - 1;
                    var isToLastYear = toDateParts[2] === currentDate.getFullYear() - 1;
                    var isCurrentYear = fromDateParts[2] === currentDate.getFullYear() &&
                        toDateParts[2] === currentDate.getFullYear();

                    if (!(isCurrentYear || (isFromLastYear && isToLastYear && currentDate <= jan31))) {
                        return MessageBox.error(this.i18nModel.getText("leaveSameYear"));
                    }

                    //  Holiday Check
                    if (oData.fromDate === oData.toDate) {
                        var isValid = true;
                        var holidays = this.getView().getModel("HolidayModel").getData();

                        holidays.forEach((holiday) => {
                            var holidayDate = new Date(holiday.Date);
                            holidayDate.setHours(0, 0, 0, 0);
                            startDate.setHours(0, 0, 0, 0);

                            if (holidayDate.getTime() === startDate.getTime()) {
                                isValid = false;
                            }
                        });

                        if (!isValid) {
                            return MessageBox.error(this.i18nModel.getText("holidaysMess"));
                        }
                    }

                    //  Backdated validation
                    if (oData.typeOfLeave === "All In One Leave") {
                        var fiveDaysBack = new Date(currentDate);
                        fiveDaysBack.setDate(currentDate.getDate() - 5);

                        if (startDate < fiveDaysBack) {
                            return MessageBox.error(this.i18nModel.getText("backdatedLeaveNotAllowed"));
                        }
                    }

                    //  No of days validation
                    if (parseFloat(oData.NoofDays) <= 0) {
                        return MessageBox.error(this.i18nModel.getText("holidaysMess"));
                    }

                    //  Weekend validation
                    if (parseFloat(oData.NoofDays) <= 2) {
                        var isFromWeekend = (startDate.getDay() === 0 || startDate.getDay() === 6);
                        var isToWeekend = (endDate.getDay() === 0 || endDate.getDay() === 6);

                        if (isFromWeekend && isToWeekend) {
                            return MessageBox.error(this.i18nModel.getText("holidaysMess"));
                        }
                    }

                    //  Already applied check
                    if (this.isLeaveAlreadyApplied(oData.fromDate, oData.toDate, this.previousLeaveDates)) {
                        return MessageBox.error(this.i18nModel.getText("leaveAlreadyApplied"));
                    }

                    //  Quota calculation (unchanged)
                    var LeaveModel = this.getView().getModel("EmpLeaveModel").getData();

                    var filteredData = LeaveModel.filter((item) => {
                        if (item.typeOfLeave !== "All In One Leave") return false;

                        var fromDate = this.onFormatDate(this.Formatter.formatDate(item.fromDate));
                        var toDate = this.onFormatDate(this.Formatter.formatDate(item.toDate));

                        var startOfYear = new Date(this.currentYear, 0, 1);
                        var endOfYear = new Date(this.currentYear, 11, 31);

                        return fromDate >= startOfYear && toDate <= endOfYear;
                    });

                    filteredData = filteredData.filter((item) => item.status !== "Rejected");

                    var totalNoofDays = filteredData.reduce((total, item) => {
                        return total + parseFloat(item.NoofDays || 0);
                    }, 0);

                    var oLeaveModel = this.getView().getModel("secondLeaveData");
                    var leaveData = oLeaveModel.getProperty("/chartData");

                    var quotaLeave = leaveData.find(function (leave) {
                        return leave.LeaveStatus === "All Quota";
                    });

                    var valid = true;
                    if (parseFloat(this.UpdateNoofDays) !== parseFloat(oData.NoofDays)) {
                        valid = totalNoofDays <= quotaLeave.Count;
                    }

                    //  Final Save Condition
                    if (oData.typeOfLeave === "LOP" || valid) {

                        //  Format dates
                        oData.fromDate = new Date(startDate.getTime() - startDate.getTimezoneOffset() * 60000)
                            .toISOString().split("T")[0];

                        oData.toDate = new Date(endDate.getTime() - endDate.getTimezoneOffset() * 60000)
                            .toISOString().split("T")[0];

                        oData.halfDay = oData.halfDay.toString();

                        this.getBusyDialog();

                        var oDataJson = {
                            ID: oData.ID,
                            ResourcePlanningType: "Resource Planning",
                            EmpID: oData.employeeID,
                            EmpName: oData.employeeName,
                            EmpEmailID: oData.email,
                            StartDate: oData.fromDate,
                            EndDate: oData.toDate,
                            status: "Submitted",
                            EmpComment: oData.comments,
                            NoofDays: oData.NoofDays,
                            HalfDay: oData.halfDay,
                            Type: "Leave",
                            SubType: oData.typeOfLeave,
                            SubmittedDate: oData.SubmittedDate || new Date().toISOString(),
                            leaveSessionType: oData.leaveSessionType
                        };

                        var requestData = {
                            filters: {
                                ID: oData.ID
                            },
                            data: oDataJson
                        };

                        // API Call
                        this.ajaxUpdateWithJQuery("InboxDetails", requestData).then(() => {
                            this.CommonReadCall();
                            this.closeBusyDialog();
                            MessageToast.show(this.i18nModel.getText("ResourcePlanningUpdatedSuccess"));
                            this.oLeaveDialog.close();
                            this.oLeaveDialog.destroy();
                            this.oLeaveDialog = null;
                        }).catch((error) => {
                            this.closeBusyDialog();
                            MessageToast.show(error.message || error.responseText);
                        });

                    } else {
                        return MessageBox.error(this.i18nModel.getText("quotaExceeded"));
                    }

                } else {
                    MessageToast.show(this.i18nModel.getText("mandetoryFields"));
                }
            } catch (error) {
                this.closeBusyDialog();
                MessageToast.show(error.message || error.responseText);
            }
        },

        generateUUID: function () {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0,
                    v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        },

        AL_onPressClose: function () {
            if (this.oLeaveDialog) {
                this.oLeaveDialog.close(); // Close dialog
                this.oLeaveDialog.destroy(); // Destroy dialog
                this.oLeaveDialog = null; // Reset reference
            }
            // this.byId("AL_id_Updatebtn").setVisible(false);
            // this.byId("AL_id_Deletebtn").setVisible(false);
            if (this._originalLeaveData) {
                var aLeaveData = this.getView().getModel("EmpLeaveModel").getProperty("/");
                var iIndex = aLeaveData.findIndex(item => item.ID === this._originalLeaveData.ID);
                if (iIndex > -1) {
                    aLeaveData[iIndex] = JSON.parse(JSON.stringify(this._originalLeaveData));
                    this.getView().getModel("EmpLeaveModel").setProperty("/", aLeaveData);
                }
                this._originalLeaveData = null;
            }
        },

        EmployeeDetReadCall: async function (entity, value) {
            try {
                let data = await this.ajaxReadWithJQuery(entity, value);
                if (data && data.data && data.data.length > 0) {
                    let joiningDateField = (entity === "Trainee") ? "JoiningDate" : "JoiningDate";
                    this.JoiningDate = this.Formatter.formatDate(data.data[0][joiningDateField]).split("/").map(Number);
                    let addYears = [];
                    let length = new Date().getFullYear() - this.JoiningDate[2];
                    for (let i = 0; i <= length; i++) {
                        addYears.push({
                            key: this.JoiningDate[2] + i,
                            text: this.JoiningDate[2] + i
                        })
                        // addYears.push(this.JoiningDate[2] + i);
                    }
                    let yearModel = new JSONModel({
                        items: addYears
                    });
                    this.getView().setModel(yearModel, "YearModel");

                } else {
                    MessageToast.show(this.i18nModel.getText("joiningDateMissing"));
                }
            } catch (error) {
                MessageToast.show(error.message || error.responseText);
            }
        },

        onValidation: function () {
            var oLeaveModel = this.getView().getModel("LeaveTempModel");
            var sFromDate = oLeaveModel.getProperty("/fromDate");
            sFromDate = this.onFormatDate(sFromDate);
            var oFromDate = new Date(sFromDate);
            if (!isNaN(oFromDate.getTime())) {
                oLeaveModel.setProperty("/MinToDate", oFromDate);
            }
        },

        onFormatDate: function (dateString) {
            var parts = dateString.split('/');
            return new Date(parts[2], parts[1] - 1, parts[0]);
        },

        calculateBusinessDays: function (startDate, endDate, holidays) {
            var start = this.onFormatDate(startDate);
            var end = this.onFormatDate(endDate);
            // Create set of holiday dates
            var holidaySet = new Set(holidays.map(function (holiday) {
                var holidayDate = this.Formatter.formatDate(holiday.Date);
                var dateObject = this.onFormatDate(holidayDate);
                return dateObject.toDateString();
            }, this));

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

        BarDisplayFunction: async function (leaveType, selectedYear, userId) {
            let jsonData = {
                "data": {
                    "EmployeeID": userId,
                    "selectYear": selectedYear,
                    "LeaveType": leaveType
                }
            };
            try {
                // Fetch data from backend
                let oData = await this.ajaxCreateWithJQuery("LeavesFirstBarChart", jsonData);
                this.closeBusyDialog();
                let firstChartData = oData.results.filter(item => ["Submitted", "Approved", "Quota"].includes(item.LeaveStatus));
                // Filter data for second chart
                let secondChartData = oData.results.filter(item => ["Submitted", "Approved", "All Quota"].includes(item.LeaveStatus));
                // Set models for charts
                let oFirstChartModel = new JSONModel({
                    chartData: firstChartData
                });
                this.getView().setModel(oFirstChartModel, "firstLeaveData");

                let oSecondChartModel = new JSONModel({
                    chartData: secondChartData
                });
                this.getView().setModel(oSecondChartModel, "secondLeaveData");
            } catch (error) {
                this.closeBusyDialog(); //  Close BusyDialog
                MessageToast.show(this.i18nModel.getText("commonErrorMessage"));
            }
        },

        isLeaveAlreadyApplied: function (fromDate, toDate, previousDates = []) {
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
    });
});