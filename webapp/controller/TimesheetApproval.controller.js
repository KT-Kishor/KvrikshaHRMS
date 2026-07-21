sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/unified/DateRange",
    "sap/suite/ui/commons/Timeline",
    "sap/suite/ui/commons/TimelineItem",
    "sap/ui/core/Fragment"
], function (BaseController, JSONModel, MessageToast, MessageBox, DateRange, Timeline, TimelineItem, Fragment) {
    "use strict";
    return BaseController.extend("sap.kt.com.minihrsolution.controller.TimesheetApproval", {

        onInit: function () {
            this.getRouter().getRoute("RouteTimesheetApproval").attachMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: async function () {
            var LoginFunction = await this.commonLoginFunction("TimesheetApproval");
            if (!LoginFunction) return;

            this.getBusyDialog();
            this.i18nModel = this.getView().getModel("i18n").getResourceBundle();
            this.getView().getModel("LoginModel").setProperty("/HeaderName", this.i18nModel.getText("headerTimesheetApproval"));

            const oViewModel = new JSONModel({
                calendarStartDate: this._getStartOfWeek(new Date()),
                isCalendarEnabled: true,
                canApproveReject: false
            });
            this.getView().setModel(oViewModel, "viewModel");
            this.getView().setModel(new JSONModel([]), "ApprovalTimesheetModel");
            this.getView().setModel(new JSONModel([]), "EmployeeFilterModel");

            // NEW: model backing the Download Timesheet dialog
            this.getView().setModel(new JSONModel({
                MonthList: this._buildMonthList(),
                SelectedEmployee: "",
                SelectedMonth: "",
                SelectedFormat: 0
            }), "DownloadTimesheetModel");

            const ManagerID = this.getView().getModel("LoginModel").getProperty("/EmployeeID");
            this.branch = this.getView().getModel("LoginModel").getProperty("/BranchCode");

            await this.readTimesheetsForManager(ManagerID);
            await this._initializeCalendarAndLegend();

            this.TSA_onClear(true); // Call clear but mark it as initial load
            this.byId("TSA_id_Status").setValue("Submitted"); // Set default status
            this._applyAllFilters(); // Apply the default filter
            this.closeBusyDialog();
            this.initializeBirthdayCarousel();
        },

        _getStartOfWeek: function (date) {
            const day = date.getDay();
            const diff = date.getDate() - day + (day === 0 ? -6 : 1);
            return new Date(date.setDate(diff));
        },

        readTimesheetsForManager: async function (ManagerID) {
            this.getBusyDialog();
            try {
                const oData = await this.ajaxReadWithJQuery("Timesheet", { ManagerID: ManagerID });
                let timesheetData = Array.isArray(oData.data) ? oData.data : [oData.data];
                const aAllowedStatuses = ["Submitted", "Approved", "Rejected"];
                this._fullApprovalData = timesheetData.filter(entry => entry && entry.Status && aAllowedStatuses.includes(entry.Status));

                const uniqueEmployees = [];
                const employeeMap = new Set();
                this._fullApprovalData.forEach(entry => {
                    if (entry.EmployeeID && !employeeMap.has(entry.EmployeeID)) {
                        employeeMap.add(entry.EmployeeID);
                        uniqueEmployees.push({ EmployeeID: entry.EmployeeID, EmployeeName: entry.EmployeeName });
                    }
                });
                this.getView().getModel("EmployeeFilterModel").setData(uniqueEmployees);
            } catch (error) {
                MessageToast.show(error.message || error.responseText);
                this._fullApprovalData = [];
            } finally {
                this.closeBusyDialog();
            }
        },

        _applyAllFilters: function () {
            if (!this._fullApprovalData) { return; }

            const oViewModel = this.getView().getModel("viewModel");
            const oEmployeeFilter = this.byId("TSA_id_Employee");
            const oMonthFilter = this.byId("TSA_id_Month");
            const oStatusFilter = this.byId("TSA_id_Status");
            const oYearPicker = this.byId("TSA_id_Year");
            const sEmployeeValue = oEmployeeFilter.getValue();
            const sMonthValue = oMonthFilter.getValue();
            const sStatusValue = oStatusFilter.getValue();
            const sYearValue = oYearPicker.getValue();
            let aFilteredData = this._fullApprovalData;
            const bIsFilterBarActive = sEmployeeValue || sMonthValue || sStatusValue || sYearValue;
            if (bIsFilterBarActive) {
                oViewModel.setProperty("/isCalendarEnabled", !(sMonthValue || sYearValue));

                if (sEmployeeValue) { aFilteredData = aFilteredData.filter(entry => entry.EmployeeID === sEmployeeValue); }
                if (sStatusValue) { aFilteredData = aFilteredData.filter(entry => entry.Status === sStatusValue); }
                if (sYearValue) {
                    aFilteredData = aFilteredData.filter(entry => {
                        if (!entry.Date) return false;
                        return (new Date(entry.Date).getFullYear()).toString() === sYearValue;
                    });
                }
                if (sMonthValue) {
                    let sMonthKey = "-1";
                    const oSelectedItem = oMonthFilter.getItems().find(item => item.getText() === sMonthValue);
                    if (oSelectedItem) { sMonthKey = oSelectedItem.getKey(); }

                    aFilteredData = aFilteredData.filter(entry => {
                        if (!entry.Date) return false;
                        return (new Date(entry.Date).getMonth() + 1).toString() === sMonthKey;
                    });
                }
            } else {
                oViewModel.setProperty("/isCalendarEnabled", true);
                const oCalendar = this.byId("TSA_id_calendar");
                const oStartDate = new Date(oCalendar.getStartDate());
                oStartDate.setHours(0, 0, 0, 0);
                const oEndDate = new Date(oStartDate);
                oEndDate.setDate(oEndDate.getDate() + oCalendar.getDays() - 1);
                oEndDate.setHours(23, 59, 59, 999);
                aFilteredData = aFilteredData.filter(entry => {
                    if (!entry.Date) return false;
                    return new Date(entry.Date) >= oStartDate && new Date(entry.Date) <= oEndDate;
                });
            }

            const oModel = this.getView().getModel("ApprovalTimesheetModel");
            oModel.setData(aFilteredData);
            oModel.refresh(true);
            this.byId("TSA_id_Table").removeSelections(true);
            this.TSA_onSelect();
        },

        onFilterChange: function () {
            this._applyAllFilters();
        },
        filterTimesheetForCurrentWeek: function () {
            this.getBusyDialog();
            setTimeout(() => {
                this._applyAllFilters();
                this.closeBusyDialog();
            }, 500);
        },
        TSA_onCalendarDateSelect: function (oEvent) {
            this.getBusyDialog();
            setTimeout(() => {
                if (!this.getView().getModel("viewModel").getProperty("/isCalendarEnabled")) {
                    this.closeBusyDialog();
                    return;
                }
                const aSelectedDates = oEvent.getSource().getSelectedDates();
                if (aSelectedDates.length > 0) {
                    const oSelectedDate = aSelectedDates[0].getStartDate();
                    oSelectedDate.setHours(0, 0, 0, 0);
                    const sEmployeeValue = this.byId("TSA_id_Employee").getValue();
                    const sStatusValue = this.byId("TSA_id_Status").getValue();
                    const sYearValue = this.byId("TSA_id_Year").getValue();
                    const sMonthValue = this.byId("TSA_id_Month").getValue();
                    let aFilteredData = this._fullApprovalData;
                    if (sEmployeeValue) {
                        aFilteredData = aFilteredData.filter(e => e.EmployeeID === sEmployeeValue);
                    }
                    if (sStatusValue) {
                        aFilteredData = aFilteredData.filter(e => e.Status === sStatusValue);
                    }
                    aFilteredData = aFilteredData.filter(entry => {
                        if (!entry.Date) return false;
                        const entryDate = new Date(entry.Date);
                        entryDate.setHours(0, 0, 0, 0);
                        return entryDate.getTime() === oSelectedDate.getTime();
                    });
                    this.getView().getModel("ApprovalTimesheetModel").setData(aFilteredData);
                } else {
                    this._applyAllFilters();
                }
                this.byId("TSA_id_Table").removeSelections(true);
                this.TSA_onSelect();
                this.closeBusyDialog();
            }, 300);
        },
        TSA_onSearch: function () {
            this.getBusyDialog();
            setTimeout(() => {
                this._applyAllFilters();
                this.closeBusyDialog();
            }, 500);
        },

        TSA_onClear: function (bIsInitialLoad) {
            this.byId("TSA_id_Employee").setValue("");
            this.byId("TSA_id_Month").setValue("");
            this.byId("TSA_id_Status").setValue("");
            this.byId("TSA_id_Year").setValue("");
            if (!bIsInitialLoad) {
                this._applyAllFilters();
            }
        },

        TSA_onSelect: function () {
            const oTable = this.byId("TSA_id_Table");
            const oSelectedItems = oTable.getSelectedItems();
            let canApproveReject = false;
            if (oSelectedItems.length > 0) {
                canApproveReject = oSelectedItems.every(item => item.getBindingContext("ApprovalTimesheetModel").getProperty("Status") === "Submitted");
            }
            this.getView().getModel("viewModel").setProperty("/canApproveReject", canApproveReject);
        },

        TSA_onApprove: function () {
            this._openManagerRemarkDialog("Approved");
        },
        TSA_onReject: function () {
            this._openManagerRemarkDialog("Rejected");
        },
        _openManagerRemarkDialog: function (status) {
            this._approvalStatus = status;
            const sTitle = status === "Approved"
                ? this.i18nModel.getText("confirmApprove")
                : this.i18nModel.getText("confirmRejectleave");

            if (!this._oManagerRemarkDialog) {
                sap.ui.core.Fragment.load({
                    name: "sap.kt.com.minihrsolution.fragment.ManagerRemarks",
                    controller: this
                }).then(function (oDialog) {
                    this._oManagerRemarkDialog = oDialog;
                    this.getView().addDependent(oDialog);

                    oDialog.setTitle(sTitle);
                    sap.ui.getCore().byId("MIF_id_RemarkLabel").setText(
                        status === "Approved"
                            ? this.i18nModel.getText("approveRemark")
                            : this.i18nModel.getText("rejectRemark")
                    );
                    sap.ui.getCore().byId("MIF_id_remark").setValue("");

                    var oOkBtn = sap.ui.getCore().byId("MIF_id_OkBtn");
                    if (oOkBtn) {
                        oOkBtn.setType(status === "Approved" ? "Transparent" : "Transparent");
                        oOkBtn.setText(status === "Approved"
                            ? this.i18nModel.getText("approve")
                            : this.i18nModel.getText("reject"));
                    }
                    oDialog.open();
                }.bind(this));
            } else {
                this._oManagerRemarkDialog.setTitle(sTitle);
                sap.ui.getCore().byId("MIF_id_RemarkLabel").setText(
                    status === "Approved"
                        ? this.i18nModel.getText("approveRemark")
                        : this.i18nModel.getText("rejectRemark")
                );
                sap.ui.getCore().byId("MIF_id_remark").setValue("");

                var oOkBtn = sap.ui.getCore().byId("MIF_id_OkBtn");
                if (oOkBtn) {
                    oOkBtn.setType(status === "Approved" ? "Transparent" : "Transparent");
                    oOkBtn.setText(status === "Approved"
                        ? this.i18nModel.getText("approve")
                        : this.i18nModel.getText("reject"));
                }
                this._oManagerRemarkDialog.open();
            }
        },

        MTF_onPressOk: async function () {
            const oTable = this.byId("TSA_id_Table");
            const oSelectedItems = oTable.getSelectedItems();
            const sRemark = sap.ui.getCore().byId("MIF_id_remark").getValue();
            const ManagerID = this.getView().getModel("LoginModel").getProperty("/EmployeeID");

            if (!this.MIF_liveChangeForMangerComments()) {
                MessageToast.show(this.i18nModel.getText("mandetoryFields"));
                return;
            }
            const aPayload = oSelectedItems.map(item => {
                const srNo = item.getBindingContext("ApprovalTimesheetModel").getProperty("SrNo");
                const managerName = item.getBindingContext("ApprovalTimesheetModel").getProperty("ManagerName");
                return {
                    filters: { SrNo: srNo },
                    data: {
                        Status: this._approvalStatus,
                        ManagerName: managerName
                    }
                };
            });
            const finalPayload = {
                comments: sRemark,
                data: aPayload
            };
            this.getBusyDialog();
            try {
                await this.ajaxUpdateWithJQuery("Timesheet", finalPayload);
                MessageToast.show(
                    this._approvalStatus === "Approved"
                        ? this.i18nModel.getText("approvedSuccess")
                        : this.i18nModel.getText("rejectedSuccess")
                );
                this._oManagerRemarkDialog.close();
                await this.readTimesheetsForManager(ManagerID)
                this._applyAllFilters();
                this.getView().getModel("viewModel").setProperty("/canApproveReject", false);

            } catch (error) {
                MessageToast.show(error.message || error.responseText);
            } finally {
                this.closeBusyDialog();
            }
        },
        MIF_liveChangeForMangerComments() {
            const input = sap.ui.getCore().byId("MIF_id_remark");
            if (!input.getValue()) {
                input.setValueStateText(this.getView().getModel('i18n').getResourceBundle().getText("commentsValueState"));
                input.setValueState("Error");
                return false;
            }
            input.setValueState("None");
            return true;
        },

        MIF_onPressClose: function () {
            if (this._oManagerRemarkDialog) {
                this._oManagerRemarkDialog.close();
            }
            this.byId("TSA_id_Table").removeSelections(true);
            sap.ui.getCore().byId("MIF_id_remark").setValue("");
            sap.ui.getCore().byId("MIF_id_remark").setValueState("None");
            this.getView().getModel("viewModel").setProperty("/canApproveReject", false);
            this._approvalStatus = null;
        },

        onPressback: function () {
            this.getRouter().navTo("RouteTilePage");
            if (this._oManagerRemarkDialog) {
                this._oManagerRemarkDialog.close();
                this._oManagerRemarkDialog.destroy();
                this._oManagerRemarkDialog = null;
            }
            // NEW: clean up download dialog too
            if (this._oDownloadDialog) {
                this._oDownloadDialog.close();
                this._oDownloadDialog.destroy();
                this._oDownloadDialog = null;
            }
        },

        TSA_onShowComments: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("ApprovalTimesheetModel");
            var oData = oContext.getObject();
            var aComments = oData.comments || [];
            aComments.sort(function (a, b) {
                var dateA = new Date(a.CommentDateTime);
                var dateB = new Date(b.CommentDateTime);
                return dateB - dateA;
            });
            var aTimelineItems = aComments.map(function (oComment) {
                return new TimelineItem({
                    dateTime: new Date(oComment.CommentDateTime).toLocaleString(),
                    title: oComment.CommentedBy || "Anonymous",
                    text: oComment.Comment || "No comment provided",
                    userNameClickable: false,
                    icon: "sap-icon://comment"
                });
            });
            var oTimeline = new Timeline({
                showHeader: false,
                enableBusyIndicator: false,
                width: "100%",
                sortOldestFirst: false,
                enableDoubleSided: false,
                content: aTimelineItems,
                showHeaderBar: false
            });
            var oDialog = new sap.m.Dialog({
                title: this.i18nModel.getText("tCommentsTitle"),
                contentWidth: "25rem",
                contentHeight: "15rem",
                draggable: true,
                resizable: true,
                content: [oTimeline],
                endButton: new sap.m.Button({
                    text: this.i18nModel.getText("close"),
                    type: "Transparent",
                    press: function () {
                        oDialog.close();
                        oDialog.destroy();
                    }
                })
            });
            oDialog.open();
        },
        _initializeCalendarAndLegend: async function () {
            const oCalendar = this.byId("TSA_id_calendar");
            if (oCalendar) {
                const oToday = new Date();
                oCalendar.removeAllSelectedDates();
                oCalendar.addSelectedDate(new DateRange({ startDate: oToday }));
                await this.initCalendarLegend(oCalendar, this.branch);
            }
        },

        onLogout: function () {
            this.CommonLogoutFunction();
        },

        // =========================================================
        // NEW: DOWNLOAD TIMESHEET FEATURE
        // =========================================================

        _buildMonthList: function () {
            var aMonthNames = ["January", "February", "March", "April", "May", "June",
                                "July", "August", "September", "October", "November", "December"];
            var oToday = new Date();
            var aMonths = [];

            for (var i = 0; i < 12; i++) {
                var oDate = new Date(oToday.getFullYear(), oToday.getMonth() - i, 1);
                var iMonthIdx = oDate.getMonth();
                var iYear = oDate.getFullYear();
                var iMonthNum = iMonthIdx + 1;

                aMonths.push({
                    MonthKey: iYear + "-" + (iMonthNum < 10 ? "0" + iMonthNum : iMonthNum), // "2026-07"
                    MonthLabel: aMonthNames[iMonthIdx] + " " + iYear // "July 2026"
                });
            }

            return aMonths;
        },

        _getMonthDateRange: function (sMonthKey) {
            var aMonthNames = [
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
            ];

            var aParts = sMonthKey.trim().split(" "); // e.g. "March 2026" -> ["March", "2026"]
            var sMonthName = aParts[0];
            var iYear = parseInt(aParts[1], 10);
            var iMonth = aMonthNames.indexOf(sMonthName); // 0-based, matches Date's month index

            if (iMonth === -1 || isNaN(iYear)) {
                throw new Error("Invalid month key: " + sMonthKey);
            }

            var oStartDate = new Date(iYear, iMonth, 1);
            var oEndDate = new Date(iYear, iMonth + 1, 0);

            var fnFormatDate = function (oDate) {
                var iM = oDate.getMonth() + 1;
                var iD = oDate.getDate();
                return oDate.getFullYear() + "-" +
                    (iM < 10 ? "0" + iM : iM) + "-" +
                    (iD < 10 ? "0" + iD : iD);
            };

            return {
                StartDate: fnFormatDate(oStartDate),
                EndDate: fnFormatDate(oEndDate)
            };
        },

        onDownloadTimesheetPress: function () {
            var oView = this.getView();
            var oDownloadModel = oView.getModel("DownloadTimesheetModel");

            oDownloadModel.setProperty("/SelectedEmployee", "");
            oDownloadModel.setProperty("/SelectedMonth", "");
            oDownloadModel.setProperty("/SelectedFormat", 0);

            if (!this._oDownloadDialog) {
                Fragment.load({
                    id: oView.getId(),
                    name: "sap.kt.com.minihrsolution.fragment.DownloadTimesheetDialog",
                    controller: this
                }).then(function (oDialog) {
                    this._oDownloadDialog = oDialog;
                    oView.addDependent(this._oDownloadDialog);
                    this._oDownloadDialog.open();
                }.bind(this));
            } else {
                this._oDownloadDialog.open();
            }
        },

        onFormatSelect: function (oEvent) {
            var sSelectedText = oEvent.getSource().getSelectedIndex();
            this.getView().getModel("DownloadTimesheetModel").setProperty("/SelectedFormat", sSelectedText);
        },

        onCancelDownload: function () {
            this._oDownloadDialog.close();
        },

        onConfirmDownload: async function () {
            var oDownloadModel = this.getView().getModel("DownloadTimesheetModel");
            var sEmployeeId = oDownloadModel.getProperty("/SelectedEmployee");
            var sMonthKey = oDownloadModel.getProperty("/SelectedMonth");
            var sFormat = oDownloadModel.getProperty("/SelectedFormat");

            if (!sEmployeeId) {
                MessageBox.warning(this.i18nModel.getText("selectEmployeeWarning") || "Please select an Employee.");
                return;
            }
            if (!sMonthKey) {
                MessageBox.warning(this.i18nModel.getText("selectMonthWarning") || "Please select a Month.");
                return;
            }

            var oDateRange = this._getMonthDateRange(sMonthKey);

            this.getBusyDialog();
            try {
                var oData = await this.ajaxReadWithJQuery("Timesheet", {
                    EmployeeID: sEmployeeId,
                    StartDate: oDateRange.StartDate,
                    EndDate: oDateRange.EndDate
                });

                var aRecords = Array.isArray(oData.data) ? oData.data : (oData.data ? [oData.data] : []);

                if (aRecords.length === 0) {
                    MessageBox.information("No timesheet data found for the selected Employee and Month.");
                    return;
                }

                var aFlattenedRecords = this._flattenTimesheetData(aRecords);

                if (sFormat === 0) {
                    this._exportToPDF(aFlattenedRecords, sEmployeeId, sMonthKey);
                } else {
                    this._exportToExcel(aFlattenedRecords, sEmployeeId, sMonthKey);
                }

                this._oDownloadDialog.close();

            } catch (error) {
                MessageToast.show(error.message || error.responseText);
            } finally {
                this.closeBusyDialog();
            }
        },

        _flattenTimesheetData: function (aRecords) {
            return aRecords.map(function (oRec) {
                var sCommentsJoined = "";

                if (oRec.comments && oRec.comments.length > 0) {
                    sCommentsJoined = oRec.comments.map(function (oComment) {
                        var sDate = oComment.CommentDateTime
                            ? new Date(oComment.CommentDateTime).toLocaleString()
                            : "";
                        return "[" + sDate + "] " + oComment.CommentedBy + ": " + oComment.Comment;
                    }).join(" | ");
                }

                return {
                    EmployeeID: oRec.EmployeeID,
                    EmployeeName: oRec.EmployeeName,
                    TaskName: oRec.TaskName,
                    Date: oRec.Date ? new Date(oRec.Date).toLocaleDateString() : "",
                    Day: oRec.Day,
                    HoursWorked: oRec.HoursWorked,
                    Status: oRec.Status,
                    ManagerName: oRec.ManagerName,
                    EmployeeComments: oRec.EmployeeComments || "",
                    ManagerComments: oRec.ManagerComments || "",
                    AllComments: sCommentsJoined
                };
            });
        },

        _exportToExcel: function (aData, sEmployeeId, sMonthKey) {
            var aCols = [
                { label: "Employee ID", property: "EmployeeID", type: "String" },
                { label: "Employee Name", property: "EmployeeName", type: "String" },
                { label: "Task", property: "TaskName", type: "String" },
                { label: "Date", property: "Date", type: "String" },
                { label: "Day", property: "Day", type: "String" },
                { label: "Hours Worked", property: "HoursWorked", type: "Number" },
                { label: "Status", property: "Status", type: "String" },
                { label: "Manager", property: "ManagerName", type: "String" },
                // { label: "Employee Comments", property: "EmployeeComments", type: "String" },
                // { label: "Manager Comments", property: "ManagerComments", type: "String" },
                // { label: "All Comments", property: "AllComments", type: "String" }
            ];

            var oSettings = {
                workbook: {
                    columns: aCols,
                    context: { sheetName: "Timesheet" }
                },
                dataSource: aData,
                fileName: "Timesheet_" + sEmployeeId + "_" + sMonthKey + ".xlsx"
            };

            sap.ui.require(["sap/ui/export/Spreadsheet"], function (Spreadsheet) {
                var oSheet = new Spreadsheet(oSettings);
                oSheet.build()
                    .then(function () {
                        MessageToast.show("Excel file downloaded successfully.");
                    })
                    .catch(function (oError) {
                        MessageBox.error("Excel export failed.");
                        console.error(oError);
                    })
                    .finally(function () {
                        oSheet.destroy();
                    });
            });
        },

        _exportToPDF: function (aData, sEmployeeId, sMonthKey) {
            // Requires pdfmake to be loaded (via CDN script tags in index.html):
            if (!window.pdfMake) {
                MessageBox.error("PDF library not loaded. Please contact your administrator.");
                return;
            }

            var aTableBody = [
                ["Employee", "Task", "Date", "Day", "Hours", "Status", "Comments"]
            ];

            aData.forEach(function (oRow) {
                aTableBody.push([
                    oRow.EmployeeName,
                    oRow.TaskName,
                    oRow.Date,
                    oRow.Day,
                    String(oRow.HoursWorked),
                    oRow.Status,
                    oRow.AllComments || "-"
                ]);
            });

            var oTotalHours = aData.reduce(function (fSum, oRow) {
                return fSum + (Number(oRow.HoursWorked) || 0);
            }, 0);

            var oDocDefinition = {
                pageOrientation: "landscape",
                content: [
                    { text: "Timesheet Report", style: "header" },
                    { text: "Employee: " + (aData[0] ? aData[0].EmployeeName : sEmployeeId), margin: [0, 0, 0, 4] },
                    { text: "Month: " + sMonthKey, margin: [0, 0, 0, 4] },
                    { text: "Total Hours: " + oTotalHours, margin: [0, 0, 0, 10] },
                    {
                        table: {
                            headerRows: 1,
                            widths: ["*", "*", "auto", "auto", "auto", "auto", "*"],
                            body: aTableBody
                        },
                        layout: "lightHorizontalLines"
                    }
                ],
                styles: {
                    header: { fontSize: 16, bold: true, margin: [0, 0, 0, 10] }
                }
            };

            window.pdfMake.createPdf(oDocDefinition).download(
                "Timesheet_" + sEmployeeId + "_" + sMonthKey + ".pdf"
            );

            MessageToast.show("PDF file downloaded successfully.");
        }

    });
});