sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/unified/DateRange",
    "sap/suite/ui/commons/Timeline",
    "sap/suite/ui/commons/TimelineItem",
    "sap/ui/export/Spreadsheet",
    "../model/formatter",
    "sap/ui/core/Fragment"
], function (BaseController, JSONModel, MessageToast,MessageBox, DateRange, Timeline, TimelineItem, Spreadsheet, Formatter,Fragment) {
    "use strict";
    return BaseController.extend("sap.kt.com.minihrsolution.controller.Timesheet", {

        Formatter: Formatter,
        onInit: function () {
            this.getRouter().getRoute("RouteTimesheet").attachMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: async function () {
            var LoginFunction = await this.commonLoginFunction("Timesheet");
            if (!LoginFunction) return;

            this.getBusyDialog();
            this.i18nModel = this.getView().getModel("i18n").getResourceBundle();
            this.getView().getModel("LoginModel").setProperty("/HeaderName", this.i18nModel.getText("tileTimesheetFooter"));
            const oViewModel = new JSONModel({
                calendarStartDate: this._getStartOfWeek(new Date()),
                isCalendarEnabled: true,
                canSubmit: false,
                canDelete: false
            }); 
            this.getView().setModel(oViewModel, "viewModel");
            this.getView().setModel(new JSONModel([]), "FilteredTimesheetModel");
                this.getView().setModel(new JSONModel({
                MonthList: this._buildMonthList(),
                SelectedMonth: "",
                SelectedFormat: 0
            }), "DownloadTimesheetModel");
            const loginModel = this.getOwnerComponent().getModel("LoginModel");
            this.EmployeeID = loginModel.getProperty("/EmployeeID");
            this.EmployeeName = loginModel.getProperty("/EmployeeName");
            this.branch = loginModel.getProperty("/BranchCode");

            await this.TSD_ReadTimesheetEntries();
            await this._initializeCalendarAndLegend();
            this.TS_onClear();
            this.closeBusyDialog();
            this.initializeBirthdayCarousel();
        },

       TSD_ReadTimesheetEntries: async function () {
    try {
        const oData = await this.ajaxReadWithJQuery("Timesheet", {
            EmployeeID: this.EmployeeID
        });

        this.timesheetData = Array.isArray(oData.data) ? oData.data : [oData.data];

        // Create unique task list
        const aTasks = [];
        const oTaskMap = {};

        this.timesheetData.forEach(function (oItem) {
            if (!oTaskMap[oItem.TaskID]) {
                oTaskMap[oItem.TaskID] = true;
                aTasks.push({
                    TaskID: oItem.TaskID,
                    TaskName: oItem.TaskName
                });
            }
        });

        // Add "All" as the first option
        aTasks.unshift({
            TaskID: "ALL",
            TaskName: "All"
        });

        this.getView().setModel(
            new JSONModel(aTasks),
            "TimesheetModel"
        );

    } catch (error) {
        this.getView().setModel(
            new JSONModel([]),
            "TimesheetModel"
        );

        this.timesheetData = [];
        MessageToast.show(error.message || error.responseText);
    }
},

        _applyAllFilters: function () {
            if (!this.timesheetData) { return; }

            const oViewModel = this.getView().getModel("viewModel");
            const oMonthFilter = this.byId("TS_monthComboBox");
            const oYearPicker = this.byId("TS_id_Year");
            const sMonthKey = oMonthFilter.getSelectedKey();
            const sYearValue = oYearPicker.getValue();

            let aFilteredData = this.timesheetData;
            if (sYearValue) {
                aFilteredData = aFilteredData.filter(entry => {
                    if (!entry.Date) return false;
                    return (new Date(entry.Date).getFullYear()).toString() === sYearValue;
                });
            }
            // Logic for Month vs. Weekly Calendar
            if (sMonthKey || sYearValue) { // Calendar is disabled if EITHER month or year is selected
                oViewModel.setProperty("/isCalendarEnabled", false);
                // Apply month filter only if a month is selected
                if (sMonthKey) {
                    aFilteredData = aFilteredData.filter(entry => {
                        if (!entry.Date) return false;
                        return (new Date(entry.Date).getMonth() + 1).toString() === sMonthKey;
                    });
                }
            } else {
                oViewModel.setProperty("/isCalendarEnabled", true);
                const oCalendar = this.byId("TS_id_calendarTimesheet");
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

            const oModel = this.getView().getModel("FilteredTimesheetModel");
            oModel.setData(aFilteredData);
            oModel.refresh(true);

            this.byId("TD_id_Table").removeSelections(true);
            this.T_TableSelectionChange();
        },


        filterTimesheetForCurrentWeek: function () {
            this.getBusyDialog();
            setTimeout(() => {
                this._applyAllFilters();
                this.closeBusyDialog();
            }, 500);
        },


        TS_onCalendarDateSelect: function (oEvent) {
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
                    const aFilteredData = this.timesheetData.filter(entry => {
                        if (!entry.Date) return false;
                        const entryDate = new Date(entry.Date);
                        entryDate.setHours(0, 0, 0, 0);
                        return entryDate.getTime() === oSelectedDate.getTime();
                    });
                    this.getView().getModel("FilteredTimesheetModel").setData(aFilteredData);
                } else {
                    this._applyAllFilters();
                }
                this.byId("TD_id_Table").removeSelections(true);
                this.T_TableSelectionChange();
                this.closeBusyDialog();
            }, 500);
        },

        T_onSearch: function () {
            this.getBusyDialog();
            setTimeout(() => {
                this._applyAllFilters();
                this.closeBusyDialog();
            }, 500);
        },

        TS_onClear: function () {
            // this.getBusyDialog();
            this.byId("TS_monthComboBox").setSelectedKey("");
            this.byId("TS_id_Year").setValue("");
            setTimeout(() => {
                this._applyAllFilters();
                // this.closeBusyDialog();
            }, 500);
        },


        TS_onFillDetails: function () {
            this.getRouter().navTo("RouteTimesheetDetails", { sPath: "Timesheet" });
        },

        TS_onPressData: function (oEvent) {
            const sPath = oEvent.getSource().getBindingContext("FilteredTimesheetModel").getProperty("SrNo");
            this.getRouter().navTo("RouteTimesheetDetails", { sPath: sPath });
        },

        _getStartOfWeek: function (date) {
            const day = date.getDay(); const diff = date.getDate() - day + (day === 0 ? -6 : 1);
            return new Date(date.setDate(diff));
        },

        onPressback: function () {
            this.getRouter().navTo("RouteTilePage");
        },
        onLogout: function () {
            this.CommonLogoutFunction(); // Navigate to login page
        },
        _initializeCalendarAndLegend: async function () {
            const oCalendar = this.byId("TS_id_calendarTimesheet");
            if (oCalendar) {
                const oToday = new Date(); oCalendar.removeAllSelectedDates();
                oCalendar.addSelectedDate(new DateRange({ startDate: oToday }));
                await this.initCalendarLegend(oCalendar, this.branch);
            }
        },

        TS_onDeleteTimesheet: async function () {
            const oTable = this.byId("TD_id_Table");
            const oSelectedItems = oTable.getSelectedItems();
            if (!oSelectedItems.length) {
                MessageToast.show(this.i18nModel.getText("selctRowtoDelete"));
                return;
            }
            const aIdsToDelete = oSelectedItems.map(item => item.getBindingContext("FilteredTimesheetModel").getProperty("SrNo"));
            this.showConfirmationDialog(this.i18nModel.getText("confirmTitle"), this.i18nModel.getText("deleteConfirm"),
                async () => {
                    try {
                        this.getBusyDialog();
                        await this.ajaxDeleteWithJQuery("Timesheet", { filters: { SrNo: aIdsToDelete } });
                        MessageToast.show(this.i18nModel.getText("deletTimesheetSuucess"));
                        await this.TSD_ReadTimesheetEntries();
                        this._applyAllFilters();
                    } catch (error) {
                        MessageToast.show(error.message || error.responseText || "Error deleting record");
                    } finally { this.closeBusyDialog(); }
                },
                () => { oTable.removeSelections(true); this.T_TableSelectionChange(); }
            );
        },

        TS_onSubmitTimesheet: async function () {
            const oTable = this.byId("TD_id_Table");
            const aSelectedItems = oTable.getSelectedItems();
            if (!aSelectedItems.length) {
                MessageToast.show(this.i18nModel.getText("selctRowtoSubmit"));
                return;
            }
            const aItems = aSelectedItems.map(item => {
                const oData = item.getBindingContext("FilteredTimesheetModel").getObject();
                return {
                    data: {
                        Status: "Submitted",
                        EmployeeID: oData.EmployeeID,
                        EmployeeName: oData.EmployeeName,
                        Hours: oData.Hours,
                        Description: oData.Description,
                        SrNo: oData.SrNo,
                        TaskID: oData.TaskID,
                        TaskName: oData.TaskName,
                        Date: oData.Date,
                        ManagerID: oData.ManagerID,
                        ManagerName: oData.ManagerName
                    },
                    filters: { SrNo: oData.SrNo }
                };
            });
            const finalPayload = { tableName: "Timesheet", data: aItems };
            this.showConfirmationDialog(this.i18nModel.getText("confirmTitle"), this.i18nModel.getText("submitConfirm"),
                async () => {
                    try {
                        this.getBusyDialog();
                        await this.ajaxUpdateWithJQuery("Timesheet", finalPayload);
                        MessageToast.show(this.i18nModel.getText("SubmitSuucess"));
                        await this.TSD_ReadTimesheetEntries();
                        this._applyAllFilters();
                    } catch (error) {
                        MessageToast.show(error.message || error.responseText);
                    } finally { this.closeBusyDialog(); }
                },
                () => { oTable.removeSelections(true); this.T_TableSelectionChange(); }
            );
        },

        T_TableSelectionChange: function () {
            const oSelectedItems = this.byId("TD_id_Table").getSelectedItems();
            const oViewModel = this.getView().getModel("viewModel");
            let bCanSubmit = false, bCanDelete = false;
            if (oSelectedItems.length > 0) {
                const bAllItemsAreModifiable = oSelectedItems.every(item => {
                    const sStatus = item.getBindingContext("FilteredTimesheetModel").getProperty("Status");
                    return sStatus !== "Submitted" && sStatus !== "Approved";
                });
                if (bAllItemsAreModifiable) { bCanSubmit = true; bCanDelete = true; }
            }
            oViewModel.setProperty("/canSubmit", bCanSubmit);
            oViewModel.setProperty("/canDelete", bCanDelete);
        },

        TS_onShowComments: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("FilteredTimesheetModel");
            var oData = oContext.getObject();
            var aComments = oData.comments || [];
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
        _findLastComment: function (aComments, sCommenterName) {
            if (!aComments || aComments.length === 0 || !sCommenterName) {
                return "";
            }
            const aFilteredComments = aComments.filter(oComment => oComment.CommentedBy === sCommenterName);
            if (aFilteredComments.length === 0) {
                return "";
            }
            aFilteredComments.sort((a, b) => new Date(b.CommentDateTime) - new Date(a.CommentDateTime));
            return aFilteredComments[0].Comment;
        },
        TS_onExport: function () {
            const aOriginalData = this.getView().getModel("FilteredTimesheetModel").getData();
            if (!aOriginalData || aOriginalData.length === 0) {
                MessageToast.show(this.i18nModel.getText("noDatainFile"));
                return;
            }
            //  PREPARE THE DATA FOR EXPORT 
            const aExportData = aOriginalData.map(oRow => {
                // Find the last comments using our new helper function
                const sEmployeeComment = this._findLastComment(oRow.comments, oRow.EmployeeName);
                const sManagerComment = this._findLastComment(oRow.comments, oRow.ManagerName);
                // Return a new, "flat" object for the export
                return {
                    EmployeeID: oRow.EmployeeID,
                    EmployeeName: oRow.EmployeeName,
                    ManagerName: oRow.ManagerName,
                    TaskID: oRow.TaskID,
                    TaskName: oRow.TaskName,
                    Date: Formatter.formatDate(oRow.Date),
                    HoursWorked: oRow.HoursWorked,
                    Status: oRow.Status,
                    EmployeeComment: sEmployeeComment,
                    ManagerComment: sManagerComment
                };
            });
            const aCols = [
                { label: this.i18nModel.getText("employeeID"), property: "EmployeeID" },
                { label: this.i18nModel.getText("employeeName"), property: "EmployeeName" },
                { label: this.i18nModel.getText("manager"), property: "ManagerName" },
                { label: this.i18nModel.getText("taskid"), property: "TaskID" },
                { label: this.i18nModel.getText("assignmentName"), property: "TaskName" },
                { label: this.i18nModel.getText("date"), property: "Date", type: "string" },
                { label: this.i18nModel.getText("hoursWorked"), property: "HoursWorked", type: "Number" },
                { label: this.i18nModel.getText("employeeComment"), property: "EmployeeComment" }, // Direct mapping
                { label: this.i18nModel.getText("managerComment"), property: "ManagerComment" },  // Direct mapping
                { label: this.i18nModel.getText("status"), property: "Status" }
            ];
            const oSettings = {
                workbook: { columns: aCols },
                context: {
                    sheetName: this.i18nModel.getText("timesheetDetails"),
                },
                dataSource: aExportData, // Use the prepared data
                fileName: "Timesheet_Details.xlsx",
                worker: false
            };
            const oSheet = new Spreadsheet(oSettings);
            oSheet.build().finally(() => oSheet.destroy());
        },

        getGroupHeader: function (oGroup) {
            return this.getStyledGroupHeader(oGroup);
        },
         onDownloadTimesheetPress: function () {
            var oView = this.getView();
            var oDownloadModel = oView.getModel("DownloadTimesheetModel");

            oDownloadModel.setProperty("/TaskName", "");
            oDownloadModel.setProperty("/SelectedMonth", "");
            oDownloadModel.setProperty("/SelectedFormat", 0);

            if (!this._oDownloadDialog) {
                Fragment.load({
                    id: oView.getId(),
                    name: "sap.kt.com.minihrsolution.fragment.TimesheetDownload",
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
        onCancelDownload: function () {
            this._oDownloadDialog.close();
        },

        onConfirmDownload: async function () {
            
          
            var oDownloadModel = this.getView().getModel("DownloadTimesheetModel");
           
            var sSelected = oDownloadModel.getProperty("/SelectedTask");
            var sMonthKey = oDownloadModel.getProperty("/SelectedMonth");
            var sFormat = oDownloadModel.getProperty("/SelectedFormat");
 if (!sSelected) {
    MessageBox.warning("Please select a Task");
    return;
}
           
            if (!sMonthKey) {
                MessageBox.warning("Please select a Month");
                return;
            }

            var oDateRange = this._getMonthDateRange(sMonthKey);

            this.getBusyDialog();
            try {
                var oData = await this.ajaxReadWithJQuery("Timesheet", {
                    EmployeeID: this.EmployeeID,
                    StartDate: oDateRange.StartDate,
                    EndDate: oDateRange.EndDate
                });

                var aRecords = Array.isArray(oData.data) ? oData.data : (oData.data ? [oData.data] : []);
               if (sSelected !== "ALL") {
    aRecords = aRecords.filter(function (oItem) {
        return oItem.TaskID === sSelected;
    });
}

                if (aRecords.length === 0) {
                    MessageBox.information("No timesheet data found for the selected Employee and Month.");
                    return;
                }

                var aFlattenedRecords = this._flattenTimesheetData(aRecords);

                if (sFormat === 0) {
                    this._exportToPDF(aFlattenedRecords, this.EmployeeID, sMonthKey);
                } else {
                    this._exportToExcel(aFlattenedRecords, this.EmployeeID, sMonthKey);
                }
oDownloadModel.setProperty("/SelectedTask", "");
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
                    // Date: oRec.Date ? new Date(oRec.Date).toLocaleDateString() : "",
                    Date: oRec.Date || "",
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
  _exportToExcel: async function (aData, sEmployeeId, sMonthKey) {

    // Sort by Date (Ascending)
    aData.sort(function (a, b) {
        return new Date(a.Date) - new Date(b.Date);
    });

    // Group data by Date
    const oGrouped = {};

    aData.forEach(function (oItem) {

        // Format Date (dd-MMM-yyyy)
        const sDate = sap.ui.core.format.DateFormat.getDateInstance({
            pattern: "dd-MMM-yyyy"
        }).format(new Date(oItem.Date));

        if (!oGrouped[sDate]) {
            oGrouped[sDate] = [];
        }
        var sComments = (oItem.AllComments || "")
    .split("|")
    .map(function (comment) {
        return comment
            .replace(/^\[[^\]]+\]\s*[^:]+:\s*/, "") // Remove [date] Name:
            .trim();
    })
    .filter(function (comment) {
        return comment !== "";
    })
    .filter(function (comment, index, array) {
        return array.indexOf(comment) === index; // Remove duplicates
    })
    .join("\n");

        oGrouped[sDate].push({
            Date: sDate,
            EmployeeID: oItem.EmployeeID,
            EmployeeName: oItem.EmployeeName,
            TaskName: oItem.TaskName,
            HoursWorked: oItem.HoursWorked,
            Status: oItem.Status,
            ManagerName: oItem.ManagerName,
            AllComments: sComments
        });
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Timesheet");

    // Columns
    sheet.columns = [
        { header: "Employee ID", key: "EmployeeID", width: 15 },
        { header: "Employee Name", key: "EmployeeName", width: 25 },
        { header: "Date", key: "Date", width: 18 },
        { header: "Task", key: "TaskName", width: 35 },
        { header: "Hours Worked", key: "HoursWorked", width: 15 },
        { header: "Status", key: "Status", width: 15 },
        { header: "Approval Manager", key: "ManagerName", width: 25 },
        { header: "Employee Comments", key: "AllComments", width: 40 },
        
                // { label: "Manager Comments", property: "ManagerComments", type: "String" },
                // { label: "All Comments", property: "AllComments", type: "String" }
    ];

    // Header Style
    sheet.getRow(1).font = {
        bold: true
    };

    sheet.getRow(1).alignment = {
        vertical: "middle",
        horizontal: "center"
    };

    let currentRow = 2;

    // Write grouped data
    Object.keys(oGrouped).forEach(function (sDate) {

        const aRows = oGrouped[sDate];
        const startRow = currentRow;

        aRows.forEach(function (oRow) {

            sheet.addRow({
                Date: oRow.Date,
                EmployeeID: oRow.EmployeeID,
                EmployeeName: oRow.EmployeeName,
                TaskName: oRow.TaskName,
                HoursWorked: oRow.HoursWorked,
                Status: oRow.Status,
                ManagerName: oRow.ManagerName,
                AllComments:oRow.AllComments

            });

            currentRow++;

        });

        const endRow = currentRow - 1;

      
      // Merge Date Column (Column C)
if (endRow > startRow) {
    sheet.mergeCells(`C${startRow}:C${endRow}`);
}

// Center merged Date cell
sheet.getCell(`C${startRow}`).alignment = {
    vertical: "middle",
    horizontal: "center"
};
    });

    // Border for all cells
    sheet.eachRow(function (row) {

        row.eachCell(function (cell) {

            cell.border = {
                top: { style: "thin" },
                left: { style: "thin" },
                bottom: { style: "thin" },
                right: { style: "thin" }
            };

            cell.alignment = {
                vertical: "middle",
                horizontal: "center",
                wrapText: true
            };

        });

    });

    // Download Excel
    const buffer = await workbook.xlsx.writeBuffer();

    const blob = new Blob([buffer], {
        type: "application/octet-stream"
    });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "Timesheet_" + this.EmployeeName + "_" + sMonthKey + ".xlsx";
    a.click();

    URL.revokeObjectURL(url);

    sap.m.MessageToast.show("Excel file downloaded successfully.");
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
                    { text: "Employee: " + (aData[0] ? aData[0].EmployeeName : this.EmployeeID), margin: [0, 0, 0, 4] },
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
                "Timesheet_" + this.EmployeeID + "_" + sMonthKey + ".pdf"
            );

            MessageToast.show("PDF file downloaded successfully.");
        }

    });
});