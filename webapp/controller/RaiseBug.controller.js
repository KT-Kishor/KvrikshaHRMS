sap.ui.define([
    "./BaseController",
    "../model/formatter",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "../utils/validation",
    "sap/ui/export/Spreadsheet",
    "sap/suite/ui/commons/Timeline", // Import Timeline for displaying comments
    "sap/suite/ui/commons/TimelineItem",
], function (BaseController, Formatter, JSONModel, MessageToast, utils, Spreadsheet, Timeline, TimelineItem) {
    "use strict";

    return BaseController.extend("sap.kt.com.minihrsolution.controller.RaiseBug", {
        Formatter: Formatter,
        onInit: function () {
            this.getRouter().getRoute("RouteRaiseBug").attachMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: async function (oEvent) {
            try {
                var LoginFUnction = await this.commonLoginFunction("ManageVendor");
                if (!LoginFUnction) return;
                this.getBusyDialog();
                this.getView().getModel("LoginModel").setProperty("/HeaderName", "Bug Details");
                this.i18nModel = this.getView().getModel("i18n").getResourceBundle();
                this.getView().byId("RB_id_RaisedBy1").setSelectedKey("")
                this.getView().byId("RB_id_Status").setSelectedKeys([])
                this.getView().byId("RB_id_SearchField").setValue("")

                this.getView().byId("RB_id_AssignedTo").setSelectedKey("")
                var oDateRange = this.byId("RB_id_Dates");

                var oToday = new Date();

                // First day of current month
                var oFirstDay = new Date(oToday.getFullYear(), oToday.getMonth(), 1);

                // Last day of current month
                var oLastDay = new Date(oToday.getFullYear(), oToday.getMonth() + 1, 0);

                oDateRange.setDateValue(oFirstDay);
                oDateRange.setSecondDateValue(oLastDay);

                await this._fetchCommonData("AllLoginDetails", "EmpModel");
                this._FragmentDatePickersReadOnly(["RB_id_ResolveDate"])
                var model = new JSONModel({
                    Visible: false,
                    Editable: false
                });
                this.getView().setModel(model, "VisibleModel");
                this.CD_read(true)
            } catch (error) {
                this.closeBusyDialog();
                MessageToast.show(error.message || error.responseText);
            }   
        },
        onGlobalSearch: function (oEvent) {
            const sQuery = oEvent.getParameter("newValue");
            const oTable = this.byId("idBugTable");
           const oBinding = oTable.getBinding("items");
            let aFilters = [];
            if (sQuery) {
                aFilters = [
                    new sap.ui.model.Filter({
                        filters: [
                            new sap.ui.model.Filter("IssueType", sap.ui.model.FilterOperator.Contains, sQuery.toString()),
                            new sap.ui.model.Filter("AssignedTo", sap.ui.model.FilterOperator.Contains, sQuery.toString()),
                            new sap.ui.model.Filter("RaisedBy", sap.ui.model.FilterOperator.Contains, sQuery.toString()),
                            new sap.ui.model.Filter("AppName", sap.ui.model.FilterOperator.Contains, sQuery.toString()),
                            new sap.ui.model.Filter("BugDescription", sap.ui.model.FilterOperator.Contains, sQuery.toString()),
                            new sap.ui.model.Filter("CreatedDate", sap.ui.model.FilterOperator.Contains, sQuery.toString()),
                            new sap.ui.model.Filter("BugID", sap.ui.model.FilterOperator.Contains, sQuery.toString()),
                             new sap.ui.model.Filter("ResolveDate", sap.ui.model.FilterOperator.Contains, sQuery.toString())
                        ],
                        and: false
                    })
                ];
            }
            oBinding.filter(aFilters);
        },



        // Apply filters for 
        SP_onPressClear: function () {
            this.getView().byId("RB_id_RaisedBy1").setSelectedKey("")
            this.getView().byId("RB_id_Status").setSelectedKeys([])
            this.getView().byId("RB_id_AssignedTo").setSelectedKey("")
            this.getView().byId("RB_id_Dates").setValue("")
            this.getView().byId("RB_id_SearchField").setValue("")
            this.getView().byId("RB_id_issuetype").setSelectedKey("")
        },

        RB_read: function () {
         
            this.getView().byId("RB_id_SearchField").setValue("")

            this.CD_read(false);
        },
           getGroupHeader: function (oGroup) {
                    return this.getStyledGroupHeader(oGroup);
                },

        CD_read: async function (flag) {
            const SRaisedBy = this.byId("RB_id_RaisedBy1").getSelectedKey() ||
                this.byId("RB_id_RaisedBy1").getValue();

            const SStatus = this.byId("RB_id_Status").getSelectedKeys() ||
                this.byId("RB_id_Status").getValue();

            const Sissuetype = this.byId("RB_id_issuetype").getSelectedKey() ||
                this.byId("RB_id_issuetype").getValue();

            // const BugID = this.byId("RB_id_BugID").getSelectedKey() ||
            //     this.byId("RB_id_BugID").getValue();

            const AssignedTo = this.byId("RB_id_AssignedTo").getSelectedKey() ||
                this.byId("RB_id_AssignedTo").getValue();

            var oDateRange = this.getView().byId("RB_id_Dates");
            var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
                pattern: "yyyy-MM-dd"
            });
            var oStartDate = oDateRange.getDateValue();
            var oEndDate = oDateRange.getSecondDateValue();

            let filters = {};

            if (SRaisedBy) filters.RaisedBy = SRaisedBy;
            if (SStatus) filters.Status = SStatus;
            // if (BugID) filters.BugID = BugID;
            if (AssignedTo) filters.AssignedTo = AssignedTo;
            if (Sissuetype) filters.IssueType = Sissuetype;


            if (oStartDate && oEndDate) {
                filters.StartDate = oDateFormat.format(oStartDate);
                filters.EndDate = oDateFormat.format(oEndDate);
            }

            this.getBusyDialog()
            await this.ajaxReadWithJQuery("RaiseBug", filters).then((oData) => {
                var oFCIAerData = Array.isArray(oData.data) ? oData.data : [oData.data];

                if (flag === true) {
                    this._originalRoomdata = oFCIAerData;
                }
                var model = new JSONModel(oFCIAerData);
                this.getView().setModel(model, "RaiseBugViewModel");
                // this._populateUniqueFilterValues(this._originalRoomdata);
            })
            this.closeBusyDialog()
        },

        // _populateUniqueFilterValues: function(data) {
        //     let uniqueValues = {
        //         RB_id_BugID: new Set(),
        //     };
        //     data.forEach(item => {
        //         if (item.BugID) {
        //             uniqueValues.RB_id_BugID.add(item.BugID.trim());
        //         }
        //     });
        //     let oView = this.getView();
        //     ["RB_id_BugID"].forEach(field => {
        //         let oComboBox = oView.byId(field);
        //         if (!oComboBox) return;
        //         oComboBox.destroyItems();
        //         Array.from(uniqueValues[field]).sort().forEach(value => {
        //             oComboBox.addItem(
        //                 new sap.ui.core.Item({
        //                     key: value,
        //                     text: value
        //                 })
        //             );
        //         });
        //     });
        // },

        onHome: function () {
            this.CommonLogoutFunction();
        },

        RB_resolve: function () {
            var table = this.byId("idBugTable");
            var selected = table.getSelectedItem();

            if (!selected) return MessageToast.show(this.i18nModel.getText("pleaseSelectRecordtoresolve"));

            var oContext = selected.getBindingContext("RaiseBugViewModel");
            var Data = oContext.getObject();

            if (Data.Status === "Resolved") return MessageToast.show(this.i18nModel.getText("alreadyResolved"));

            if (!this.SP_Dialog) {
                this.SP_Dialog = sap.ui.xmlfragment("sap.kt.com.minihrsolution.fragment.ResolveBug", this);
                this.getView().addDependent(this.SP_Dialog);
            }

            this.SP_Dialog.open();

            // Get Fragment Controls
            var oDesc = sap.ui.getCore().byId("RB_id_Description");
            var oDate = sap.ui.getCore().byId("RB_id_ResolutionDate");
            if (oDesc) {
                oDesc.setValue("");
                oDesc.setValueState("None");
            }
            if (oDate) {
                // Set today's date correctly
                oDate.setDateValue(new Date());
                oDate.setValueState("None");
            }
            this._FragmentDatePickersReadOnly(["RB_id_ResolutionDate"]);
        },

        supportCancel: function () {
            this.byId("idBugTable").removeSelections();
            this.SP_Dialog.close();
        },

        onDescInputLiveChange: function (oEvent) {
            utils._LCvalidateMandatoryField(oEvent.getSource(), "ID");
        },

        onResolveDateChange: function (oEvent) {
            utils._LCvalidateDate(oEvent);
        },

        BugResolveSave: function () {
            var oDesc = sap.ui.getCore().byId("RB_id_Description");
            var oDatePicker = sap.ui.getCore().byId("RB_id_ResolutionDate");

            if (utils._LCvalidateMandatoryField(oDesc, "ID") && utils._LCvalidateMandatoryField(oDatePicker, "ID")) {

                var table = this.byId("idBugTable");
                var selected = table.getSelectedItem();

                if (!selected) return MessageToast.show(this.i18nModel.getText("pleaseSelectRecordtoresolve"));

                var oContext = selected.getBindingContext("RaiseBugViewModel");
                var SPData = oContext.getObject();

                // Get Date properly
                var oDate = oDatePicker.getDateValue();

                if (!oDate) return MessageToast.show("Please select a valid resolution date");

                // Format Date
                var sResolvedDate = oDate.toISOString().split("T")[0];;

                var Payload = {
                    "BugID": SPData.BugID,
                    "AppName": SPData.AppName,
                    "BugDescription": SPData.BugDescription,
                    "RaisedBy": SPData.RaisedBy,
                    "Email": SPData.Email,
                    "ResolvedDescription": oDesc.getValue(),
                    "Status": "Resolved",
                    "ResolvedDate": sResolvedDate
                };

                this.getBusyDialog();
                this.ajaxUpdateWithJQuery("RaiseBug", {
                    data: Payload,
                    filters: {
                        BugID: SPData.BugID
                    }
                }).then(async (oData) => {
                    MessageToast.show("Bug Resolved Successfully");
                    await this.CD_read(true);
                    this.SP_Dialog.close();
                }).catch((oError) => {
                    MessageToast.show("Error while updating Bug request");
                }).finally(() => {
                    this.closeBusyDialog();
                });
            } else {
                MessageToast.show(this.i18nModel.getText("MSfillallfields"));
            }
        },

        HF_viewroom: async function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("RaiseBugViewModel");
            var oRowData = oContext.getObject();

            var filter = {
                BugID: oRowData.BugID
            };

            this.getBusyDialog();

            this.ajaxReadWithJQuery("RaiseBugdata", filter).then((oData) => {
                this.closeBusyDialog();
                if (!oData.data || oData.data.length === 0) return sap.m.MessageBox.information("No data found");
                const record = oData.data[0];

                let aImages = [];
                if (record.Photo1) {
                    aImages.push({
                        src: record.Photo1,
                        type: record.Photo1Type
                    });
                }

                if (record.Photo2) {
                    aImages.push({
                        src: record.Photo2,
                        type: record.Photo2Type
                    });
                }

                if (record.Photo3) {
                    aImages.push({
                        src: record.Photo3,
                        type: record.Photo3Type
                    });
                }

                if (aImages.length === 0) return MessageBox.information("No images uploaded.");

                // Convert Base64 images
                const aCarouselImages = aImages.map(function (img) {

                    let base64 = img.src.replace(/\s/g, "");

                    if (!base64.startsWith("data:image")) {
                        base64 = "data:" + img.type + ";base64," + base64;
                    }

                    return new sap.m.Image({
                        src: base64,
                        width: "100%",
                        height: "100%",
                        style: "object-fit: cover; display:block; margin:0; padding:0;",
                        densityAware: false,
                        decorative: false,
                    });
                });
                this._openImageDialog(aCarouselImages);
            }).catch((err) => {
                this.closeBusyDialog();
                sap.m.MessageBox.information("No images uploaded.");
            });
        },

        _openImageDialog: function (aImages) {
            // Create Carousel
            var oCarousel = new sap.m.Carousel({
                pages: aImages,
                width: "100%",
                height: "400px",
                showPageIndicator: false
            });

            this._oDialog = new sap.m.Dialog({
                title: "Support Images",
                contentWidth: "60%",
                contentHeight: "60%",
                resizable: true,
                draggable: true,
                content: [oCarousel],
                endButton: new sap.m.Button({
                    text: "Close",
                    press: () => {
                        this._oDialog.close();
                    }
                }),
                afterClose: () => {
                    this._oDialog.destroy();
                }
            });
            this._oDialog.open();
        },

        createTableSheet: function () {
            return [{
                label: "Bug ID",
                property: "BugID",
                type: "string"
            },
            {
                label: "App Name",
                property: "AppName",
                type: "string"
            },
            {
                label: "Bug Description",
                property: "BugDescription",
                type: "string"
            },
            {
                label: "Issue Type",
                property: "IssueType",
                type: "string"
            },
            {
                label: "Raised By",
                property: "RaisedBy",
                type: "string"
            },
            {
                label: "Assigned To",
                property: "AssignedTo",
                type: "string"
            },
            {
                label: "Created Date",
                property: "CreatedDate",
                type: "string"
            },
            {
                label: "Status",
                property: "Status",
                type: "string"
            },
            {
                label: "Resolved Date",
                property: "ResolvedDate",
                type: "string"
            },
            ]
        },

        RB_onDownload: function () {
            const oModel = this.byId("idBugTable").getModel("RaiseBugViewModel").getData();
            if (!oModel || oModel.length === 0) return MessageToast.show(this.i18nModel.getText("MSnodata"));

            const adjustedData = oModel.map(item => {

                let resolvedDate = "";
                let createdDate = "";

                if (item.ResolvedDate && item.ResolvedDate !== "null" && item.ResolvedDate !== "1899-11-30") {
                    const d = new Date(item.ResolvedDate);
                    if (d.getFullYear() > 1900) {
                        resolvedDate = Formatter.formatDate(item.ResolvedDate);
                    }
                }
                if (item.CreatedDate) {
                    const d2 = new Date(item.CreatedDate);
                    if (d2.getFullYear() > 1900) {
                        createdDate = Formatter.formatDate(item.CreatedDate);
                    }
                }
                return {
                    ...item,
                    ResolvedDate: resolvedDate,
                    CreatedDate: createdDate
                };
            });
            const aCols = this.createTableSheet();
            const oSettings = {
                workbook: {
                    columns: aCols,
                    hierarchyLevel: "Level",
                    context: {
                        sheetName: "Bug Details"
                    }
                },
                dataSource: adjustedData,
                fileName: "Bug_Details.xlsx",
                worker: false
            };
            MessageToast.show(this.i18nModel.getText("downloadingBug"));
            const oSheet = new sap.ui.export.Spreadsheet(oSettings);

            oSheet.build().then(() => {
                MessageToast.show(this.i18nModel.getText("MSdownloadedsuccess"));
            }).finally(() => {
                oSheet.destroy();
            });
        },

        onPressback: function () {
            this.getOwnerComponent().getRouter().navTo("RouteTilePage");
        },

        onLogout: function () {
            this.getOwnerComponent().getRouter().navTo("RouteLoginPage");
        },

        Common_Open_BugDialog: function () {
            if (!this._RaiseBugDialog) {
                sap.ui.core.Fragment.load({
                    id: this.getView().getId(),
                    name: "sap.kt.com.minihrsolution.fragment.RaiseBug",
                    controller: this
                }).then(function (oDialog) {
                    this._RaiseBugDialog = oDialog;
                    this.getView().addDependent(oDialog);
                    oDialog.open();

                    this._RaiseBugDialog.attachAfterClose(() => {
                        this.RB_onCancelButtonPress();
                    });
                }.bind(this));
            } else {
                this._RaiseBugDialog.open();
            }

        },

        RB_Update_Bug: function (oEvent) {
            var logindata = this.getOwnerComponent().getModel("LoginModel").getData()
            var table = this.byId("idBugTable");
            var selected = table.getSelectedItem();

            if (!selected) return MessageToast.show(this.i18nModel.getText("pleaseSelectRecordtoupdate"));

            var oContext = selected.getBindingContext("RaiseBugViewModel");
            var Data = oContext.getObject();
            this.id = Data.AssignedToID
            Data.ContractStatus = Data.Status
            Data.EmployeeName = Data.AssignedTo
            Data.ResolveDate = Data.ResolvedDate ? Formatter.formatDate(Data.ResolvedDate) : ""



            const model = new JSONModel(Data);
            this.getView().setModel(model, "RaiseBugModel");
            this.byId("RB_id_RaisedBy1").setSelectedKey(this.byId("RB_id_RaisedBy1").getSelectedKey())
            this.byId("RB_id_AssignedTo").setSelectedKey(this.byId("RB_id_AssignedTo").getSelectedKey())
            this.byId("RB_id_Status").setSelectedKeys(this.byId("RB_id_Status").getSelectedKeys())
            this.byId("RB_id_issuetype").setSelectedKey(this.byId("RB_id_issuetype").getSelectedKey())
            this.getView().getModel("RaiseBugModel").setProperty("/Submit", false);
            this.Common_Open_BugDialog();
        },

        RB_onCancelButtonPress: function () {
            this.byId("idBugTable").removeSelections();
            if (this._RaiseBugDialog) {
                this._RaiseBugDialog.close();
            }
            this.byId("RB_id_Email").setValueState("None");
            this.byId("RB_id_RBStatus").setValueState("None");
            this.byId("RB_id_comments").setValueState("None");
            this.byId("RB_id_ResolveDate").setValueState("None");
        },

        onAppnamechanges: function (oEvent) {
            utils._LCstrictValidationComboBox(oEvent)
            this.byId("RB_id_ResolveDate").setValue("");
        },

        onBugdescriptionchnages: function (oEvent) {
            utils._LCvalidateMandatoryField(oEvent)
        },

        onBugRaisedby: function (oEvent) {
            utils._LCvalidateMandatoryField(oEvent)
        },

        onBugEmailchange: function (oEvent) {
            utils._LCstrictValidationComboBox(oEvent)
            var oSelectedItem = oEvent.getSource().getSelectedItem();
            if (oSelectedItem) {
                this.getView().getModel("RaiseBugModel").setProperty("/Email", oSelectedItem.getAdditionalText());
            }
        },

        onPressBugSave: async function () {
            const oView = this.getView();
            const oBugModel = oView.getModel("RaiseBugModel").getData();

            // VALIDATION
            if (oBugModel.ContractStatus !== "Resolved") {
                var isMandatoryValid = (
                    utils._LCstrictValidationComboBox(sap.ui.getCore().byId(oView.createId("RB_id_Email")), "ID") &&
                    utils._LCstrictValidationComboBox(sap.ui.getCore().byId(oView.createId("RB_id_RBStatus")), "ID") &&

                    utils._LCvalidateMandatoryField(sap.ui.getCore().byId(oView.createId("RB_id_comments")), "ID")

                );
            } else {
                var isMandatoryValid = (
                    utils._LCstrictValidationComboBox(sap.ui.getCore().byId(oView.createId("RB_id_Email")), "ID") &&
                    utils._LCstrictValidationComboBox(sap.ui.getCore().byId(oView.createId("RB_id_RBStatus")), "ID") &&
                    utils._LCvalidateDate(sap.ui.getCore().byId(oView.createId("RB_id_ResolveDate")), "ID") &&

                    utils._LCvalidateMandatoryField(sap.ui.getCore().byId(oView.createId("RB_id_comments")), "ID")

                );
            }

            if (!isMandatoryValid) {
                return MessageToast.show(this.i18nModel.getText("mandetoryFields"));
            }

            const data = {
                AppName: oBugModel.AppName,
                BugDescription: oBugModel.BugDescription,
                RaisedBy: oBugModel.RaisedBy,
                Status: oBugModel.ContractStatus,
                Comments: oBugModel.Comments,
                BugID: oBugModel.BugID,
                EmployeeName: this.getView().getModel("LoginModel").getProperty("/EmployeeName"),
                RaisedID: this.getView().getModel("LoginModel").getProperty("/EmployeeID"),
                AssignedToID: oBugModel.Email ? oBugModel.Email : this.id,
                AssignedTo: oBugModel.EmployeeName,
                ResolvedDate: oBugModel.ResolveDate ? oBugModel.ResolveDate.split('/').reverse().join('/') : ""
            };

            var payload = {
                filters: { BugID: oBugModel.BugID },
                data: data
            };

            this.getBusyDialog();
            await this.ajaxUpdateWithJQuery("RaiseBug", payload);
            this.getView().byId("RB_id_SearchField").setValue("")
            this.CD_read(true);
            MessageToast.show("Bug updated successfully");
            // this.RB_onCancelButtonPress();
            this._RaiseBugDialog.close();
        },

        HF_viewComments: async function (oEvent) {
            this.getBusyDialog();

            const response = await this.ajaxReadWithJQuery("AllComments", {
                ApplicationName: "Raise Bug"
            });
            const aAllComments = response.data || [];
            this.closeBusyDialog();
            var oContext = oEvent.getSource().getBindingContext("RaiseBugViewModel");
            var oData = oContext.getObject();
            var sEmpID = oData.BugID

            var aFilteredComments = aAllComments.filter(function (oComment) {
                return oComment.ApplicationName === "Raise Bug" && oComment.ID === sEmpID;
            });

            let oContent;
            if (aFilteredComments.length === 0) {
                // Show "No Data" message
                oContent = new sap.m.VBox({
                    alignItems: "Center",
                    justifyContent: "Center",
                    items: [
                        new sap.m.Text({
                            text: "No Data Found",
                            design: "Bold"
                        })
                    ]
                }).addStyleClass("sapUiSmallMargin");
            } else {
                // Map into Timeline Items
                var aTimelineItems = aFilteredComments.slice().reverse().map(function (oComment) {
                    return new sap.suite.ui.commons.TimelineItem({
                        dateTime: new Date(oComment.CommentDateTime).toLocaleString(),
                        title: (oComment.CommentedBy || "Anonymous") + " (" + (oComment.Status || "No Status") + ")",
                        text: oComment.Comment || "No comment provided",
                        userNameClickable: false,
                        icon: "sap-icon://comment"
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
                    showHeaderBar: false
                });
            }

            // Dialog
            var oDialog = new sap.m.Dialog({
                title: "Bug Comments",
                contentWidth: "25rem",
                contentHeight: "15rem",
                verticalScrolling: false,
                horizontalScrolling: false,
                draggable: true,
                resizable: true,
                content: [oContent],
                endButton: new sap.m.Button({
                    text: "Close",
                    type: "Transparent",
                    press: function () {
                        oDialog.close();
                        oDialog.destroy();
                    }
                })
            });
            oDialog.open();
        }
    });
});