sap.ui.define([
    "./BaseController",
    "../model/formatter",
    "sap/ui/model/json/JSONModel",
 "sap/ui/export/Spreadsheet",
"sap/m/MessageToast",
], function (
    BaseController,
    Formatter,
    JSONModel,
    Spreadsheet,
    MessageToast
) {
    "use strict";

    return BaseController.extend("sap.kt.com.minihrsolution.controller.AssetObjectPage", {
        Formatter: Formatter,
        onInit: function () {
            this.getOwnerComponent().getRouter().getRoute("AssetObjectPage").attachMatched(this._onRouteMatched, this);
        },
        _onRouteMatched: async function (oEvent) {
            var LoginFunction = await this.commonLoginFunction("AssetAssignment");
            if (!LoginFunction) return;
            var Layout = this.byId("ObjectPageLayout");
            Layout.setSelectedSection(this.byId("OB_Timeline"));
            this.getBusyDialog()
            this.Name = oEvent.getParameter("arguments").Name;
            this.Slno = oEvent.getParameter("arguments").sPath;
            await this._fetchCommonData("IncomeAsset", "objectModel", {
                SerialNumber: this.Slno,
            });


            this.closeBusyDialog()
            var data = this.getOwnerComponent().getModel("objectModel").getData();
            var timelineData = [];
            var currentItem = data.find(function (item) {
                return item.IsCurrent == 1;
            });

            if (currentItem) {
                this.getView().getModel("objectModel").setProperty("/Status", currentItem.Status);
            }
            data.forEach(function (item) {
                if (item.TransferDate && item.TransferDate !== "1899-11-30T00:00:00.000Z") {
                    timelineData.push({
                        type: "Transfer",
                        // dateTime: item.TransferDate,
                        // userName: item.TransferByName,
                        // title: item.TransferByID,
                        // Status: "Transferred",
                        text: item.ReferenceNumber ? "Reference Number: " + item.ReferenceNumber : "",

                        title: "The asset was transferred by " + item.TransferByName + " (" + item.TransferByID + ") to " + item.TransferBranch + " "
                            + "on " + new Date(item.TransferDate).toLocaleDateString('en-GB')

                    });
                }
                if (item.AssetCreationDate && item.Status != "Transferred") {
                    timelineData.push({
                        type: "Asset Creation",
                       
                        title: "The asset was picked by " + item.PickedEmployeeName + " (" + item.PickedEmployeeID + ") in " + item.PickedBranch + " "
                            + "on " + new Date(item.AssetCreationDate).toLocaleDateString('en-GB')
                    })
                }

                if (item.AssignedDate) {
                    timelineData.push({
                        type: "Assignment",
                     
                        title: "The asset was assigned to " + item.AssignEmployeeName + " (" + item.AssignEmployeeID + ") " + "by " +
                            item.AssignedByEmployeeName
                            + " (" + item.AssignedByEmployeeID + ") in " + item.AssignBranch + " " + "on "
                            + new Date(item.AssignedDate).toLocaleDateString('en-GB'),


                    });
                }
                  if (item.ReturnRequestDate  && item.ReturnRequestDate !== "1899-11-30T00:00:00.000Z") {
                    timelineData.push({
                        type: "Return request", 
                        text: item.ReturnRequestComments ? "Comment: " + item.ReturnRequestComments : "",

                        title: "The asset was Return request to " + item.ReturnrequestEmpName + " (" + item.ReturnrequestEmpID + ") " + "by " +
                            item.AssignEmployeeName
                            + " (" + item.AssignEmployeeID + ") in " + item.AssignBranch + " " + "on "
                            + new Date(item.ReturnRequestDate).toLocaleDateString('en-GB'),
                    });
                }
                 if (item.AcceptReqEmpID) {
                    timelineData.push({
                        type: "Accepted", 

                      title: "The asset was accepted by " + item.AcceptrequestEmpName  + " (" + item.AcceptReqEmpID + ") to " + item.AssignEmployeeName
                            + " (" + item.AssignEmployeeID + ") in "  + item.AssignBranch + " " + "on "
                            + new Date(item.ReturnRequestDate).toLocaleDateString('en-GB'),
                    })
                }

                if (item.ReturnDate && item.ReturnDate !== "1899-11-30T00:00:00.000Z") {
                    timelineData.push({
                        type: "Return",
                      
                        text: item.Comments ? "Comment: " + item.Comments : "",
                        title: "The asset was returned by " + item.AssignEmployeeName + " (" + item.AssignEmployeeID + ") to " + item.ReturnEmpName
                            + " (" + item.ReturnEmpID + ") in " + item.ReturnBranch + " " + "on " + new Date(item.ReturnDate).toLocaleDateString('en-GB')

                    });
                }
                if (item.TrashDate) {
                    timelineData.push({
                        type: "Trash",
                       
                        text: item.TrashComments ? "Comment: " + item.TrashComments : "",
                        title: "The asset was Trashed by " + item.TrashByEmployeeName + " (" + item.TrashByEmployeeID + ") in " + item.TrashBranch + " on " +
                            new Date(item.TrashDate).toLocaleDateString('en-GB')
                    });
                }
               
                
            });
            var oModel = new JSONModel(timelineData.reverse());
            this.getView().setModel(oModel, "Mymodel");

        },

        onLogout: function () {
            this.CommonLogoutFunction();
        },

        getTimelineDate: function (assetDate, assignedDate, status) {
            if (status === "Available") {
                return this.formatDate(assetDate);
            } else {
                return this.formatDate(assignedDate);
            }
        },
        AOP_onButtonPress: function () {
            if (this.Name === "Asset") {
                this.getRouter().navTo("RouteAssetAssignment");
            } else {
                this.getRouter().navTo("RouteIncomeAsset",{
                    from: "AssetObjectPage"
                });
            }
        },
         _downloadExcel: function(aExportData) {

 var aCols = [
    { label: "Status", property: "Status" },
    { label: "Employee", property: "Employee" },
    { label: "Employee ID", property: "EmployeeID" },
    { label: "Branch", property: "Branch" },
    { label: "Date", property: "Date" },
    { label: "Remarks", property: "Remarks" }
];
var sModelName = this.getView()
        .getModel("objectModel")
        .getProperty("/0/Model");

    var oSettings = {
        workbook: {
            columns: aCols
        },
        dataSource: aExportData,
        fileName:sModelName +"-"+ "AssetHistory.xlsx"
    };

    var oSheet = new Spreadsheet(oSettings);

    oSheet.build().finally(function () {
        oSheet.destroy();
    });
},

onExcelDownload: function () {

    var aData = this.getView().getModel("objectModel").getData();
    var aExportData = [];

    aData.forEach(function (item) {

        // Available
        if (item.AssetCreationDate) {
            aExportData.push({
                Status: "Available",
                Employee: item.PickedEmployeeName,
                EmployeeID: item.PickedEmployeeID,
                Branch: item.PickedBranch,
                Date: new Date(item.AssetCreationDate).toLocaleDateString("en-GB"),
                Remarks: "Asset Picked"
            });
        }

        // Transfer
        if (item.TransferDate &&
            item.TransferDate !== "1899-11-30T00:00:00.000Z") {

            aExportData.push({
                Status: "Transfer",
                Employee: item.TransferByName,
                EmployeeID: item.TransferByID,
                Branch: item.TransferBranch,
                Date: new Date(item.TransferDate).toLocaleDateString("en-GB"),
                Remarks: item.ReferenceNumber ?
                    "Reference No: " + item.ReferenceNumber : ""
            });
        }

        // Assigned
        if (item.AssignedDate) {

            aExportData.push({
                Status: "Assigned",
                Employee: item.AssignEmployeeName,
                EmployeeID: item.AssignEmployeeID,
                Branch: item.AssignBranch,
                Date: new Date(item.AssignedDate).toLocaleDateString("en-GB"),
                Remarks:
                    "Assigned By: " +
                    item.AssignedByEmployeeName +
                    " (" + item.AssignedByEmployeeID + ")"
            });
        }

        // Return
        if (item.ReturnDate &&
            item.ReturnDate !== "1899-11-30T00:00:00.000Z") {

            aExportData.push({
                Status: "Return",
                Employee: item.ReturnEmpName,
                EmployeeID: item.ReturnEmpID,
                Branch: item.ReturnBranch,
                Date: new Date(item.ReturnDate).toLocaleDateString("en-GB"),
                Remarks: item.Comments || ""
            });
        }
        // Return request
         if (item.ReturnRequestDate &&
            item.ReturnRequestDate !== "1899-11-30T00:00:00.000Z") {

            aExportData.push({
                Status: "Return request",
                Employee: item.ReturnrequestEmpName,
                EmployeeID: item.ReturnrequestEmpID,
                Branch: item.AssignBranch,
                Date: new Date(item.ReturnRequestDate).toLocaleDateString("en-GB"),
                Remarks: item.ReturnRequestComments || ""
            });
        }
        //   Accept request
         if (item.AcceptReqEmpID) {

            aExportData.push({
                Status: "Accepted",
                Employee: item.AcceptrequestEmpName,
                EmployeeID: item.AcceptReqEmpID,
                Branch: item.AssignBranch,
                Date: new Date(item.ReturnRequestDate).toLocaleDateString("en-GB"),
            });
        }

        // Trash
        if (item.TrashDate &&
            item.TrashDate !== "1899-11-30T00:00:00.000Z") {

            aExportData.push({
                Status: "Trash",
                Employee: item.TrashByEmployeeName,
                EmployeeID: item.TrashByEmployeeID,
                Branch: item.TrashBranch,
                Date: new Date(item.TrashDate).toLocaleDateString("en-GB"),
                Remarks: item.TrashComments || ""
            });
        }

    });
this._downloadExcel(aExportData);
    // Export using Spreadsheet
},

onPDFDownload: function () {
    var doc = new jspdf.jsPDF("p", "mm", "a4");
    var aData = this.getView().getModel("objectModel").getData();

    if (!aData || !aData.length) {
        MessageToast.show("No data available");
        return;
    }

    var oAsset = aData[0];
    var oCurrent = aData.find(function (item) {
        return item.IsCurrent == 1;
    }) || {};

    // Helper functions
    var formatDate = function (sDate) {
        if (!sDate || sDate === "1899-11-30T00:00:00.000Z") return "";
        var oDate = new Date(sDate);
        return isNaN(oDate.getTime()) ? "" : oDate.toLocaleDateString("en-GB");
    };

    var safe = function (v) {
        return v || "";
    };

    // ------------------- 1. Collect data & metrics -------------------
    var events = [];
    var uniqueEmployeeIds = new Set();
    var uniqueBranches = new Set();
    var transferCount = 0;

    aData.forEach(function (item) {
        // AVAILABLE
        if (item.AssetCreationDate) {
            events.push({
                type: "AVAILABLE",
                date: item.AssetCreationDate,
                title: "Asset available",
                details: [
                    "Picked by: " + safe(item.PickedEmployeeName) + " (" + safe(item.PickedEmployeeID) + ")",
                    "Branch: " + safe(item.PickedBranch)
                ],
                color: [46, 125, 50]   // green
            });
            if (item.PickedEmployeeID) uniqueEmployeeIds.add(item.PickedEmployeeID);
            if (item.PickedBranch) uniqueBranches.add(item.PickedBranch);
        }
        // TRANSFER
        if (item.TransferDate && item.TransferDate !== "1899-11-30T00:00:00.000Z") {
            events.push({
                type: "TRANSFER",
                date: item.TransferDate,
                title: "Asset transferred",
                details: [
                    "Transferred by: " + safe(item.TransferByName) + " (" + safe(item.TransferByID) + ")",
                    "Transfer branch: " + safe(item.TransferBranch),
                    "Reference no: " + safe(item.ReferenceNumber)
                ],
                color: [245, 124, 0]   // orange
            });
            if (item.TransferByID) uniqueEmployeeIds.add(item.TransferByID);
            if (item.TransferBranch) uniqueBranches.add(item.TransferBranch);
            transferCount++;
        }
        // ASSIGNED
        if (item.AssignedDate) {
            events.push({
                type: "ASSIGNED",
                date: item.AssignedDate,
                title: "Asset assigned",
                details: [
                    "Assigned to: " + safe(item.AssignEmployeeName) + " (" + safe(item.AssignEmployeeID) + ")",
                    "Assigned by: " + safe(item.AssignedByEmployeeName) + " (" + safe(item.AssignedByEmployeeID) + ")",
                    "Branch: " + safe(item.AssignBranch)
                ],
                color: [25, 118, 210]  // blue
            });
            if (item.AssignEmployeeID) uniqueEmployeeIds.add(item.AssignEmployeeID);
            if (item.AssignedByEmployeeID) uniqueEmployeeIds.add(item.AssignedByEmployeeID);
            if (item.AssignBranch) uniqueBranches.add(item.AssignBranch);
        }
        //   Return request
          if (item.ReturnRequestDate && item.ReturnRequestDate !=="1899-11-30T00:00:00.000Z") {
              events.push({
                type: "RETURN REQUEST",
                date: item.ReturnRequestDate,
                title: "Asset Return Request",
                details: [
                    "Returned request to: " + safe(item.ReturnrequestEmpName) + " (" + safe(item.ReturnrequestEmpID) + ")",
                    "Branch: " + safe(item.AssignBranch),
                    "Comment: " + safe(item.ReturnRequestComments)
                ],
                color: [123, 31, 162]  // purple
            });
            if (item.ReturnrequestEmpID) uniqueEmployeeIds.add(item.ReturnrequestEmpID);
            if (item.AssignBranch) uniqueBranches.add(item.AssignBranch);
        }
        //  Accept request
         if (item.AcceptReqEmpID) {
             events.push({
                type: "Accept REQUEST",
                date: item.ReturnRequestDate,
                title: "Asset Accept Request",
                details: [
                    "Accepted by: " + safe(item.AcceptrequestEmpName) + " (" + safe(item.AcceptReqEmpID) + ")",
                    "Branch: " + safe(item.AssignBranch),
                ],
                color: [123, 31, 162]  // purple
            });
            if (item.AcceptReqEmpID) uniqueEmployeeIds.add(item.AcceptReqEmpID);
            if (item.AssignBranch) uniqueBranches.add(item.AssignBranch);
        }
        // RETURN
        if (item.ReturnDate && item.ReturnDate !== "1899-11-30T00:00:00.000Z") {
            events.push({
                type: "RETURN",
                date: item.ReturnDate,
                title: "Asset returned",
                details: [
                    "Returned to: " + safe(item.ReturnEmpName) + " (" + safe(item.ReturnEmpID) + ")",
                    "Branch: " + safe(item.ReturnBranch),
                    "Comment: " + safe(item.Comments)
                ],
                color: [123, 31, 162]  // purple
            });
            if (item.ReturnEmpID) uniqueEmployeeIds.add(item.ReturnEmpID);
            if (item.ReturnBranch) uniqueBranches.add(item.ReturnBranch);
        }
        // TRASH
        if (item.TrashDate && item.TrashDate !== "1899-11-30T00:00:00.000Z") {
            events.push({
                type: "TRASH",
                date: item.TrashDate,
                title: "Asset trashed",
                details: [
                    "Trashed by: " + safe(item.TrashByEmployeeName) + " (" + safe(item.TrashByEmployeeID) + ")",
                    "Branch: " + safe(item.TrashBranch),
                    "Comment: " + safe(item.TrashComments)
                ],
                color: [158, 158, 158]  // grey
            });
            if (item.TrashByEmployeeID) uniqueEmployeeIds.add(item.TrashByEmployeeID);
            if (item.TrashBranch) uniqueBranches.add(item.TrashBranch);
        }
    });

    events.sort(function (a, b) {
        return new Date(a.date) - new Date(b.date);
    });

    var totalEvents = events.length;
    var totalEmployees = uniqueEmployeeIds.size;
    var totalBranches = uniqueBranches.size;

    // ------------------- 2. PDF setup -------------------
    var pageWidth = doc.internal.pageSize.getWidth();
    var pageHeight = doc.internal.pageSize.getHeight();
    var margin = 12;
    var contentWidth = pageWidth - (margin * 2);
    var y = 12;

    var addPageIfNeeded = function (requiredHeight) {
        if (y + requiredHeight > pageHeight - 15) {
            doc.addPage();
            y = 15;
        }
    };

    var drawFilledRect = function (x, y, w, h, color, radius = 3) {
        doc.setFillColor(color[0], color[1], color[2]);
        doc.roundedRect(x, y, w, h, radius, radius, "F");
    };

    var drawBorderRect = function (x, y, w, h, color, radius = 3) {
        doc.setDrawColor(color[0], color[1], color[2]);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(x, y, w, h, radius, radius, "FD");
    };

    // ------------------- 3. Header with background color -------------------
    // Dark blue header bar
    drawFilledRect(margin, y, contentWidth, 38, [28, 37, 54], 4);
    doc.setTextColor(255, 255, 255);

     doc.setFont("helvetica", "bold");
    // Title
     doc.setFontSize(18);
    doc.text("Asset History Report", margin + 6, y + 20);
   
    // Asset ID inside header
   
    doc.setFontSize(9);
    doc.text("ASSET NAME — " + safe(oAsset.Model || oAsset.ID || oAsset.AssetID || "N/A"), margin + 6, y + 8);
   
   
   
   
    // Subtitle
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Generated " + new Date().toLocaleDateString("en-GB") + " · " + totalEvents + " lifecycle events · Confidential", margin + 6, y + 30);
   
    y += 46;

    // ------------------- 4. Current status card (with light background and border) -------------------
    drawBorderRect(margin, y, contentWidth, 26, [220, 220, 220], 4);
    doc.setFillColor(250, 250, 252);
    doc.roundedRect(margin, y, contentWidth, 26, 4, 4, "F");
   
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text("Current status", margin + 8, y + 8);
   
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(28, 37, 54);
    var statusText = safe(oCurrent.Status) || "Unknown";
    doc.text(statusText, margin + 8, y + 19);
   
    var currentBranch = oCurrent.AssignBranch || oCurrent.PickedBranch || oCurrent.TransferBranch || oCurrent.ReturnBranch || "-";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text("Branch", pageWidth - margin - 45, y + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(28, 37, 54);
    doc.text(currentBranch, pageWidth - margin - 45, y + 19);
   
    y += 34;

    // ------------------- 5. Four metric cards (with background and shadow effect) -------------------
    var cardWidth = (contentWidth - 6) / 4;
    var gap = 2;
    var metrics = [
        { label: "Total events", value: totalEvents },
        { label: "Employees involved", value: totalEmployees },
        { label: "Branches", value: totalBranches },
        { label: "Transfers", value: transferCount }
    ];
   
    metrics.forEach(function (metric, idx) {
        var x = margin + (idx * (cardWidth + gap));
        // Shadow (light grey offset)
        doc.setFillColor(235, 235, 235);
        doc.roundedRect(x + 1, y + 1, cardWidth, 28, 3, 3, "F");
        // Main card background
        drawFilledRect(x, y, cardWidth, 28, [255, 255, 255], 3);
        doc.setDrawColor(210, 210, 210);
        doc.roundedRect(x, y, cardWidth, 28, 3, 3, "D");
       
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(metric.label, x + 6, y + 10);
        doc.setFontSize(16);
        doc.setTextColor(28, 37, 54);
        doc.text(metric.value.toString(), x + 6, y + 23);
    });
   
    y += 38;

    // ------------------- 6. Timeline section title -------------------
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(20, 20, 20);
    doc.text("Lifecycle timeline", margin, y);
    y += 10;

    if (events.length === 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text("No lifecycle events recorded.", margin, y);
        doc.save((oAsset.Model || "Asset") + " Asset History.pdf");
        return;
    }

    // ------------------- 7. Timeline cards with left color bar (design) -------------------
    events.forEach(function (event) {
        var detailsHeight = 0;
        var wrappedDetails = [];
        event.details.forEach(function (detail) {
            var lines = doc.splitTextToSize(detail, contentWidth - 30);
            wrappedDetails.push(lines);
            detailsHeight += (lines.length * 4.5) + 1.5;
        });
        var cardHeight = 16 + detailsHeight + 8;
        addPageIfNeeded(cardHeight);

        // Card white background with border
        drawBorderRect(margin, y, contentWidth, cardHeight, [220, 220, 220], 4);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(margin, y, contentWidth, cardHeight, 4, 4, "F");

        // Left colored bar (event type color)
        drawFilledRect(margin, y, 6, cardHeight, event.color, 0);
       
        // Event type badge (dark background)
         // Type text only (no badge background)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        
        // Use the event color for the text
        doc.setTextColor(0,0,0);

        doc.text(event.type, margin + 12, y + 12);
        // doc.setFillColor(60, 60, 60);
        // doc.roundedRect(margin + 12, y + 6, 32, 8, 2, 2, "F");
        // doc.setTextColor(255, 255, 255);
        // doc.setFont("helvetica", "bold");
        // doc.setFontSize(7);
        // doc.text(event.type, margin + 16, y + 12);
       
        // Title
        doc.setTextColor(40, 40, 40);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(event.title, margin + 50, y + 11);
       
        // Date
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(formatDate(event.date), pageWidth - margin - 25, y + 11);
       
        // Details
        var innerY = y + 20;
        doc.setTextColor(70, 70, 70);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        wrappedDetails.forEach(function (lines) {
            doc.text(lines, margin + 12, innerY);
            innerY += (lines.length * 4.5) + 1.5;
        });
       
        y += cardHeight + 6;
    });

    // ------------------- 8. Save PDF -------------------
    var sFileName = (oAsset.Model || "Asset") + " Asset History.pdf";
    doc.save(sFileName);
}
    });
});