sap.ui.define(
    ["./BaseController", "sap/ui/export/Spreadsheet",
        "sap/suite/ui/commons/networkgraph/Status"],
    (BaseController, Spreadsheet) => {
        "use strict";

        return BaseController.extend(
            "sap.kt.com.minihrsolution.controller.MaintainData",
            {
                onInit() {
                    this.getRouter()
                        .getRoute("MaintainData")
                        .attachMatched(this._onRouteMatched, this);
                },
                _onRouteMatched: async function () {
                    var that = this;
                    var LoginFUnction = await this.commonLoginFunction("MaintainData");
                    if (!LoginFUnction) return;
                    that.i18nModel = that.getView().getModel("i18n").getResourceBundle();
                    that
                        .getView()
                        .getModel("LoginModel")
                        .setProperty("/HeaderName", that.i18nModel.getText("pageTitle"));

                    const listItem = new sap.ui.model.json.JSONModel({
                        ListData: [
                            { key: 1, title: "Country" },
                            { key: 2, title: "State" },
                            { key: 3, title: "City" },
                            { key: 4, title: "TaxCalculation" },
                        ],
                    });
                    this.getView().setModel(listItem, "listNameData");
                    this.onEntitySelect(null, "Country");
                    // this.getView().getModel("").getData()

                    const EntitySetModel = new sap.ui.model.json.JSONModel({
                        ListData: [
                            { Entity: "Country", unikey: "code" },
                            { Entity: "State", unikey: "stateName" },
                            { Entity: "City", unikey: "countryCode,cityName,stateName" },
                            { Entity: "TaxCalculation", unikey: "TaxPercentage" },
                        ],
                    });
                    this.getView().setModel(EntitySetModel, "EntityModel");
                },

                onEntitySelect: async function (oEvent, entity) {
                    var oItem;
                    var that = this;
                    if (oEvent && oEvent.getParameter("listItem")) {
                        oItem = oEvent.getParameter("listItem");
                        this.sTitle = oItem.getTitle();
                    } else {
                        this.sTitle = entity;
                    }

                    var oDetailContainer = this.byId("detailContainer");
                    oDetailContainer.removeAllItems();

                    this.getBusyDialog();
                    let data = await this.ajaxReadWithJQuery(this.sTitle, "");
                    let BmodelData = data.data;
                    this.closeBusyDialog();

                    const dataModelSt = new sap.ui.model.json.JSONModel(BmodelData);
                    this.getView().setModel(dataModelSt, "dataModel");

                    if (BmodelData) {
                        // Create Table
                        this.oTable = new sap.m.Table({
                            inset: false,
                            growing: true,
                            growingScrollToLoad: true,
                            mode: sap.m.ListMode.SingleSelectLeft,
                            sticky: ["ColumnHeaders"],
                            autoPopinMode: true, // enables pop-in of columns on small screens
                            demandPopin: true, // automatically moves extra columns into pop-in
                            fitContainer: true,
                            width: "100%",
                        });

                        if (BmodelData && BmodelData.length > 0) {
                            //Extract property names from first object
                            var aFields = Object.keys(BmodelData[0]);
                            let UpdateToUpperCase = [];

                            for (let i = 0; i < aFields.length; i++) {
                                let b = aFields[i].toUpperCase();
                                UpdateToUpperCase.push(b);
                            }

                            // Create columns dynamically
                            UpdateToUpperCase.forEach(function (sField) {
                                that.oTable.addColumn(
                                    new sap.m.Column({
                                        header: new sap.m.Label({
                                            text: sField
                                        }).addStyleClass("whiteLabel")
                                    })
                                );
                            });

                            var aCells = [];
                            aFields.forEach(function (sField) {
                                aCells.push(
                                    new sap.m.Text({ text: `{dataModel>` + sField + "}" })
                                );
                            });

                            var oTemplate = new sap.m.ColumnListItem({
                                cells: aCells,
                            });

                            //Bind table
                            this.oTable.bindItems({
                                path: `dataModel>/`,
                                template: oTemplate,
                            });
                        }

                        //Add Table to Detail
                        oDetailContainer.addItem(this.oTable);
                    }
                },
                onPressback: function () {
                    this.getRouter().navTo("RouteTilePage"); // Navigate to tile page
                },

                onLogout: function () {
                    this.CommonLogoutFunction(); // Navigate to login page
                },
                MD_AddButtonPress: function (oData, flag) {
                    let getModel = this.getView().getModel("dataModel");
                    let oView = this.getView();

                    let isEvent = oData && oData.getSource;
                    let oPayload = isEvent ? {} : oData || {};

                    if (oData) {
                        this.oPayload = { ...oPayload };
                    } else {
                        this.oPayload = null;
                    }

                    let keys = this.getView().getModel("EntityModel").getData()
                        .ListData.find(e => e.Entity === this.sTitle).unikey.split(",");

                    let template = {};
                    keys.forEach(k => {
                        template[k] = null;
                    });

                    if (!this.oUpdatePass) {
                        sap.ui.core.Fragment.load({
                            name: "sap.kt.com.minihrsolution.fragment.MaintainData",
                            controller: this,
                        }).then(
                            function (oUpdatePass) {
                                this.oUpdatePass = oUpdatePass;
                                oView.addDependent(this.oUpdatePass);
                                let oJsonModel = new sap.ui.model.json.JSONModel();
                                oJsonModel.setData({ ...template, ...oPayload });
                                this.oUpdatePass.setModel(oJsonModel, "formModel");

                                this.oUpdatePass.open();
                                this.commonFragmentButtonsHandle(flag);
                                this.commonFiledInput(oData);
                            }.bind(this)
                        );
                    } else {
                        let oJsonModel = new sap.ui.model.json.JSONModel();
                        oJsonModel.setData({ ...template, ...oPayload });
                        this.oUpdatePass.setModel(oJsonModel, "formModel");

                        this.oUpdatePass.open();
                        this.commonFragmentButtonsHandle(flag);
                        this.commonFiledInput(oData);
                    }
                    this.oTable.removeSelections();
                },

                commonFragmentButtonsHandle: function (flag) {
                    if (flag) {
                        sap.ui.getCore().byId("MD_id_saveButoon").setVisible(true);
                        sap.ui.getCore().byId("MD_id_submitButoon").setVisible(false);
                        this.oUpdatePass.setTitle("Update Record");
                    } else {
                        sap.ui.getCore().byId("MD_id_saveButoon").setVisible(false);
                        sap.ui.getCore().byId("MD_id_submitButoon").setVisible(true);
                        this.oUpdatePass.setTitle("Add New Record");
                    }
                },
                MD_onCancelButtonPress: function () {
                    if (this.oUpdatePass) {
                        this.oUpdatePass.close();
                    }
                    this.oTable.removeSelections();
                },

                commonFiledInput: function (oData) {
                    let getModel = this.getView().getModel("dataModel");
                    let oFields = Object.keys(getModel.getData()[0]);
                    var oForm = sap.ui.getCore().byId("dynamicForm");

                    var oDynamicData = {};
                    oFields.forEach(function (sField) {
                        oDynamicData[sField] = ""; // initialize empty
                    });

                    // Create a JSONModel for form data
                    var oDynamicModel = new sap.ui.model.json.JSONModel(oDynamicData);
                    this.getView().setModel(oDynamicModel, "formModel");

                    // Clear old content
                    oForm.removeAllItems();

                    // Loop through fields
                    oFields.forEach(function (sField) {
                        // Create Label
                        var oLabel = new sap.m.Label({
                            text: sField.toUpperCase(), // field name as label
                            labelFor: sField + "_input", // associate with input
                        });
                        oLabel.addStyleClass("sapMLabelRequired");

                        // Create Input
                        var oInput = new sap.m.Input({
                            value: "{formModel>/" + sField + "}",
                            // id: sField + "_input",        // unique id
                            // placeholder: "Enter " + sField
                        });
                        // oInput.setRequired(true);

                        // Add to layout
                        oForm.addItem(oLabel);
                        oForm.addItem(oInput);
                    });
                },
                MD_UploadButtonPress: function () {
                    let getModel = this.getView().getModel("dataModel");

                    let oView = this.getView();
                    if (!this.oLeaveDialog) {
                        sap.ui.core.Fragment.load({
                            name: "sap.kt.com.minihrsolution.fragment.AddHolidayList",
                            controller: this,
                        }).then(
                            function (oLeaveDialog) {
                                this.oLeaveDialog = oLeaveDialog;
                                oView.addDependent(this.oLeaveDialog);
                                this.oLeaveDialog.setTitle("Upload country data");
                                this.oLeaveDialog.open();
                                sap.ui.getCore().byId("ALH_id_Date").setVisible(false);
                            }.bind(this)
                        );
                    } else {
                        this.oLeaveDialog.open();
                        this.oLeaveDialog.setTitle("Upload country data");
                        sap.ui.getCore().byId("ALH_id_Date").setVisible(false);
                    }
                    this.oTable.removeSelections();
                },
                LOH_onUpload: function (oEvent) {
                    var oFile = oEvent.getParameter("files")[0];
                    if (oFile) {
                        var reader = new FileReader();

                        reader.onload = async function (e) {
                            // Convert file into array buffer
                            var data = new Uint8Array(e.target.result);

                            // Read workbook
                            var workbook = XLSX.read(data, { type: "array" });

                            // Take first sheet
                            var sheetName = workbook.SheetNames[0];
                            var sheet = workbook.Sheets[sheetName];

                            // Convert sheet → JSON
                            this.jsonData = XLSX.utils.sheet_to_json(sheet, { defval: "" });
                            this.excelData = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0];
                        }.bind(this);

                        reader.readAsArrayBuffer(oFile);
                    }
                },

                LOH_onPressSubmit: async function () {
                    let that = this;

                    let getModel = this.getView().getModel("dataModel");
                    if (!getModel) {
                        sap.m.MessageToast.show("Please select table");
                        return;
                    }
                    // Get dynamic field names (columns)
                    var aFields = Object.keys(getModel.getData()[0]);
                    let inUpperCasecol = aFields.map((elem) => {
                        return elem.toUpperCase();
                    })

                    let columnfromEX = this.excelData;

                    const missingColumns = inUpperCasecol.filter(col => !columnfromEX.includes(col));
                    if (missingColumns.length > 0) {
                        sap.m.MessageToast.show("Upload correct Excel columns: " + missingColumns.join(", "));
                        return;
                    }

                    let fileUploaderInput = sap.ui
                        .getCore()
                        .byId("ALH_id_LocFileUpload")
                        .getValue();
                    if (!fileUploaderInput) {
                        sap.m.MessageToast.show(
                            that.i18nModel.getText("messagePleseelectfile")
                        );
                        return;
                    }

                    const datafromexcel = { data: this.jsonData };
                    that.getBusyDialog();
                    let successCount = 0;
                    for (let i = 0; i < datafromexcel.data.length; i++) {
                        let row = datafromexcel.data[i];
                        try {
                            await that.ajaxCreateWithJQuery(that.sTitle, { data: row });
                            successCount++;
                        } catch (error) {
                            continue;
                        }
                    }
                    that.LOH_onPressClose();
                    that.closeBusyDialog();
                    this.oTable.removeSelections();
                    if (successCount > 0) {
                        sap.m.MessageToast.show(successCount + " record uploaded successfully.");
                    } else {
                        sap.m.MessageToast.show("No records uploaded.");
                    }
                },

                LOH_onPressClose: function () {
                    sap.ui.getCore().byId("ALH_id_LocFileUpload").setValue("");
                    this.oLeaveDialog.close();
                    this.oLeaveDialog.destroy();
                    this.oLeaveDialog = null;
                },
                MD_DownloadButtonPress: function () {
                    let getModel = this.getView().getModel("dataModel");
                    if (!getModel) {
                        sap.m.MessageToast.show("Please select table");
                        return;
                    }
                    // Get dynamic field names (columns)
                    var aFields = Object.keys(getModel.getData()[0]);

                    // Create column config dynamically
                    var aCols = aFields.map(function (sField) {
                        return {
                            label: sField.toUpperCase(), // Excel Column Name
                            property: sField, // Property from data
                            type: "string", // You can adjust (string, number, date)
                        };
                    });

                    // Configure Spreadsheet
                    var oSettings = {
                        workbook: { columns: aCols },
                        dataSource: [],
                        fileName: "Excel_Template.xlsx",
                    };

                    // Create and save Excel
                    var oSheet = new Spreadsheet(oSettings);
                    oSheet
                        .build()
                        .then(function () {
                            sap.m.MessageToast.showthat.i18nModel.getText("exceldownload");
                        })
                        .finally(function () {
                            oSheet.destroy();
                        });
                    this.oTable.removeSelections();
                },

                normalizeData: function (obj) {
                    let result = {};
                    for (let key in obj) {
                        if (Object.hasOwn(obj, key)) {
                            let val = obj[key];
                            if (typeof val === "string" && val.trim() === "") {
                                result[key] = null;
                            } else {
                                result[key] = val;
                            }
                        }
                    }
                    return result;
                },
                MD_onSubmitButtonPress: function () {
                    var that = this;
                    let formData = this.oUpdatePass.getModel("formModel");
                    let myfragmentData = formData.getData();

                    let cleanedData = this.normalizeData(myfragmentData);

                    if (!cleanedData || Object.keys(cleanedData).length === 0) {
                        sap.m.MessageToast.show("Please fill the details");
                        return;
                    }

                    let entityMeta = this.getView().getModel("EntityModel").getData()
                        .ListData.find(e => e.Entity === this.sTitle);

                    let keys = (entityMeta && entityMeta.unikey) ? entityMeta.unikey.split(",") : [];
                    let missingFields = keys.filter(k => !cleanedData[k] || cleanedData[k].toString().trim() === "");

                    if (missingFields.length > 0) {
                        sap.m.MessageToast.show("Please fill mandatory Field - " +" " + missingFields);
                        return;
                    }

                    let oPayload = { data: cleanedData };

                    this.getBusyDialog();
                    that.ajaxCreateWithJQuery(this.sTitle, oPayload)
                        .then(async (res) => {
                            that.MD_onCancelButtonPress();
                            let oModel = that.getView().getModel("dataModel");
                            const tableUpdateData = await that.ajaxReadWithJQuery(that.sTitle, "");
                            oModel.setData(tableUpdateData.data);
                            that.closeBusyDialog();
                            sap.m.MessageToast.show("Data saved successfully");
                        })
                        .catch((error) => {
                            // console.log("Backend error:", error);
                            that.closeBusyDialog();
                            sap.m.MessageToast.show("Data already exist");
                            that.MD_onCancelButtonPress();
                        });

                    this.oTable.removeSelections();
                },


                MD_DeleteTableRow: async function () {
                    var that = this;
                    var aSelectedItems = this.oTable.getSelectedItems();

                    if (aSelectedItems.length === 0) {
                        sap.m.MessageToast.show(that.i18nModel.getText("selctRowtoDelete"));
                        return;
                    }

                    sap.m.MessageBox.confirm("Are you sure you want to delete the selected record?", {
                        title: "Confirm Deletion",
                        onClose: function (oAction) {
                            if (oAction === sap.m.MessageBox.Action.OK) {

                                that.getBusyDialog();
                                aSelectedItems.forEach(function (oItem) {
                                    var oContext = oItem.getBindingContext("dataModel");
                                    var oRowData = oContext.getObject();

                                    // that.getBusyDialog();
                                    let datafromlocalEntity = that
                                        .getView()
                                        .getModel("EntityModel")
                                        .getData();

                                    for (let i = 0; i < datafromlocalEntity.ListData.length; i++) {
                                        if (datafromlocalEntity.ListData[i].Entity === that.sTitle) {
                                            let keys = datafromlocalEntity.ListData[i].unikey.split(",");
                                            let filters = {};

                                            keys.forEach((k) => {
                                                if (!filters[k]) {
                                                    filters[k] = [];
                                                }
                                                filters[k].push(oRowData[k]); // collect values
                                            });

                                            let resultfinak = { filters: filters };
                                            // console.log(resultfinak);

                                            that
                                                .ajaxDeleteWithJQuery(that.sTitle, resultfinak)
                                                .then(async (res) => {
                                                    let oModel = that.getView().getModel("dataModel");
                                                    const tableUpdateData = await that.ajaxReadWithJQuery(that.sTitle, "");
                                                    oModel.setData(tableUpdateData.data);
                                                    that.closeBusyDialog();
                                                    sap.m.MessageToast.show(that.i18nModel.getText("dataDelteSucces"));
                                                });
                                        }
                                    }
                                });
                                that.oTable.removeSelections();
                            } else {
                                that.oTable.removeSelections();
                            }
                        }
                    });
                },

                MD_UpdateTableRow: function () {
                    var that = this;
                    var aSelectedItems = this.oTable.getSelectedItem();

                    if (!aSelectedItems) {
                        sap.m.MessageToast.show(that.i18nModel.getText("selectRowUpdate"));
                        return;
                    }
                    let oData = aSelectedItems.getBindingContext("dataModel").getObject();
                    // console.log(oData);
                    let flag = true;
                    this.MD_AddButtonPress(oData, flag);
                    this.oTable.removeSelections();
                },

                MD_onUpdateButtonPress: async function () {
                    sap.ui.getCore().byId("MD_id_submitButoon").setVisible(false);
                    var that = this;
                    let datafromlocalEntity = that
                        .getView()
                        .getModel("EntityModel")
                        .getData();
                    let formData = this.oUpdatePass.getModel("formModel");
                    let myfragmentData = formData.getData();


                    let entityMeta = this.getView().getModel("EntityModel").getData()
                        .ListData.find(e => e.Entity === this.sTitle);

                    let keys = (entityMeta && entityMeta.unikey) ? entityMeta.unikey.split(",") : [];
                    let missingFields = keys.filter(k => !myfragmentData[k] || myfragmentData[k].toString().trim() === "");

                    if (missingFields.length > 0) {
                        sap.m.MessageToast.show("Please fill mandatory details");
                        return;
                    }

                    for (let i = 0; i < datafromlocalEntity.ListData.length; i++) {
                        if (datafromlocalEntity.ListData[i].Entity === that.sTitle) {
                            let keys = datafromlocalEntity.ListData[i].unikey.split(",");
                            let filters = {};

                            // Build filters dynamically
                            keys.forEach((k) => {
                                filters[k] = this.oPayload[k];
                            });

                            // Wrap into final object
                            let resultfinak = {
                                data: { ...myfragmentData }, // full row (dynamic)
                                filters: filters, // only required fields
                            };
                            this.getBusyDialog();
                            that
                                .ajaxUpdateWithJQuery(this.sTitle, resultfinak)
                                .then(async (res) => {
                                    let oModel = that.getView().getModel("dataModel");
                                    that.MD_onCancelButtonPress();
                                    const tableUpdateData = await that.ajaxReadWithJQuery(that.sTitle, "");
                                    oModel.setData(tableUpdateData.data);
                                    that.closeBusyDialog();
                                    sap.m.MessageToast.show("Data updated successfully");
                                })
                                .catch((error) => {
                                    sap.m.MessageToast.show("Already exist record");
                                    that.closeBusyDialog();
                                    that.MD_onCancelButtonPress();
                                });

                            this.oTable.removeSelections();
                        }
                    }
                },
            }
        );
    }
);
