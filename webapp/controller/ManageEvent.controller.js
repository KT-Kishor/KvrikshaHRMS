sap.ui.define(
    [
        "./BaseController",
        "sap/ui/model/json/JSONModel",
        "sap/m/MessageBox",
        "sap/m/MessageToast",
        "../utils/validation",
        "../model/formatter",
    ],
    function (BaseController, JSONModel, MessageBox, MessageToast, utils,Formatter) {
        "use strict";

        return BaseController.extend(
            "sap.kt.com.minihrsolution.controller.ManageEvent",
            {
                Formatter: Formatter,
                onInit: function () {

                    const oViewModel = new JSONModel({
                        isEditMode: false,
                        selectedDepartment: "",
                    });
                    this.getView().setModel(oViewModel, "viewModel");
                    this.getRouter()
                        .getRoute("RouteManageEvent")
                        .attachPatternMatched(this.QD_onRouteMatched, this);
                },

                QD_onRouteMatched: async function () {
                    var LoginFunction = await this.commonLoginFunction("ManageEvent");
                    if (!LoginFunction) return;
                    //  this.getBusyDialog();
                    const oView = this.getView();
                    const oLoginModel = oView.getModel("LoginModel");
                    const oLoginData = oLoginModel.getData();
                    this.oLoginModel = oLoginData;
                    this.i18nModel = this.getOwnerComponent()
                        .getModel("i18n")
                        .getResourceBundle();
                    // this.byId("QD_id_Department").setSelectedKey("")

                    oLoginModel.setProperty("/HeaderName", this.i18nModel.getText("manageevrnt"));

                    var oTaskData = {
                        EventName: "",
                        TimeSlot: "",
                        Content: "",
                        Link: "",
                        Address: "",
                        File: "",
                        FileName: "",
                        FileType: "",
                        IsEdit: false
                    };

                    // Create JSON Model
                    var oModel = new JSONModel();

                    // Set Data to Model
                    oModel.setData(oTaskData);

                    // Set Model to View
                    this.getView().setModel(oModel, "EventModel");
                    var oTokenModel = new JSONModel({
                        tokens: []
                    });

                    this.getView().setModel(oTokenModel, "tokenModel");
                    this.ME_getEventData()
                },
                ME_onCreatePress: async function () {

                    // Empty Model
                    var oTaskData = {

                        ID: "",

                        EventName: "",

                        TimeSlot: "",

                        Content: "",

                        Link: "",

                        Address: "",

                        File: "",

                        FileName: "",

                        FileType: "",

                        IsEdit: false
                    };

                    var oModel = new JSONModel(
                        oTaskData
                    );

                    this.getView().setModel(
                        oModel,
                        "EventModel"
                    );

                    // Clear Tokens
                    this.getView()
                        .getModel("tokenModel")
                        .setProperty("/tokens", []);

                    // Load Fragment
                    if (!this._oEventFragment) {

                        this._oEventFragment =
                            await sap.ui.core.Fragment.load({

                                id: this.getView().getId(),

                                name:
                                    "sap.kt.com.minihrsolution.fragment.ManageEvent",

                                controller: this
                            });

                        this.getView().addDependent(
                            this._oEventFragment
                        );
                    }

                    this._oEventFragment.open();
                },
                MEF_onCancelButtonPress: function () {

                    if (this._oEventFragment) {

                        this._oEventFragment.close();
                    }
                },
                onEventnamechange: function (oEvent) {
                    utils._LCvalidateMandatoryField(oEvent)
                },
                ValidateCommonFields: function (oEvent) {
                    utils._LCvalidateMandatoryField(oEvent)
                },
                onEventContentchange: function (oEvent) {
                    utils._LCvalidateMandatoryField(oEvent)
                },
                onEventlinkclick: function (oEvent) {
                    utils._LCvalidateMandatoryField(oEvent)
                },
                // onEventaddress: function (oEvent) {
                //     utils._LCvalidateMandatoryField(oEvent)
                // },
                ME_viewroom: function (oEvent) {

                    // Get Selected Row Data
                    var oContext = oEvent.getSource().getBindingContext("ManageEventModel");
                    var oData = oContext.getObject();

                    // Check Image Exists
                    if (!oData.File || !oData.File.length) {

                        sap.m.MessageBox.information(
                            "No image uploaded.",
                            {
                                title: "Information"
                            }
                        );

                        return;
                    }

                    // Base64 Handling
                    var sBase64 = oData.File.replace(/\s/g, "");

                    // Add Base64 Prefix if Missing
                    if (sBase64 && !sBase64.startsWith("data:image")) {

                        sBase64 =
                            "data:" +
                            oData.FileType +
                            ";base64," +
                            sBase64;
                    }

                    // Create Image
                    var oImage = new sap.m.Image({
                        src: sBase64,
                        densityAware: false,
                        decorative: false,
                        width: "100%",
                        height: "100%"
                    });

                    // Dialog
                    var oDialog = new sap.m.Dialog({

                        title: oData.FileName || "Event Image",

                        contentWidth: "50%",
                        contentHeight: "60%",

                        horizontalScrolling: false,
                        verticalScrolling: false,

                        content: [oImage],

                        endButton: new sap.m.Button({

                            text: "Close",

                            press: function () {
                                oDialog.close();
                            }

                        }),

                        afterClose: function () {
                            oDialog.destroy();
                        }

                    });

                    // Optional CSS Class
                    oDialog.addStyleClass("ImageDialogNoPadding");

                    oDialog.open();
                },

               onEventFileChange: function (oEvent) {
    var oFile = oEvent.getParameter("files")[0];

    if (!oFile) {
        return;
    }

    var oEventModel = this.getView().getModel("EventModel");
    var oTokenModel = this.getView().getModel("tokenModel");
    var oFileUploader = oEvent.getSource();

    var oReader = new FileReader();
    var sExistingFileName = oEventModel.getProperty("/FileName");

// Duplicate Check
if (sExistingFileName === oFile.name) {
    MessageToast.show("Same file already uploaded");
    return;
}

    oReader.onload = function (e) {
        var sBase64 = e.target.result.split(",")[1];

        // Remove previous file data and overwrite with latest file
        oEventModel.setProperty("/File", "");
        oEventModel.setProperty("/FileName", "");
        oEventModel.setProperty("/FileType", "");

        // Set latest file data
        oEventModel.setProperty("/File", sBase64);
        oEventModel.setProperty("/FileName", oFile.name);
        oEventModel.setProperty("/FileType", oFile.type);

        // Replace old token with latest token
        oTokenModel.setProperty("/tokens", [{
            key: oFile.name,
            text: oFile.name
        }]);

        MessageToast.show("File uploaded successfully");
    };
    

    oReader.onerror = function () {
        MessageToast.show("Failed to read file");
    };

    oReader.readAsDataURL(oFile);

    // Optional: clear uploader value so same file can be reselected later
    if (oFileUploader && oFileUploader.clear) {
        oFileUploader.clear();
    }
},
                onTokenDelete: function (oEvent) {

    // Deleted Tokens
    const aDeletedTokens =
        oEvent.getParameter("tokens");

    // Models
    const oEventModel =
        this.getView().getModel("EventModel");

    const oTokenModel =
        this.getView().getModel("tokenModel");

    // Existing Tokens
    let aTokens =
        oTokenModel.getProperty("/tokens") || [];

    // Loop Deleted Tokens
    aDeletedTokens.forEach((oToken) => {

        const sKey = oToken.getKey();

        // Remove Token
        aTokens = aTokens.filter(function (oItem) {

            return oItem.key !== sKey;
        });

    });

    // Update Token Model
    oTokenModel.setProperty(
        "/tokens",
        aTokens
    );

    // Clear EventModel File Data
    oEventModel.setProperty("/File", "");
    oEventModel.setProperty("/FileName", "");
    oEventModel.setProperty("/FileType", "");

    sap.m.MessageToast.show(
        "Image removed successfully"
    );
},

                ME_getEventData: async function () {

                    try {

                        this.getBusyDialog();

                        // AJAX Read Call
                        const response = await this.ajaxReadWithJQuery(
                            "ManageEvent"
                        );

                        var aData = response.data || [];

                        // Create JSON Model
                        var oModel = new JSONModel({
                            Questions: aData
                        });

                        // Set Model to View
                        this.getView().setModel(oModel, "ManageEventModel");

                    } catch (oError) {
                        this.closeBusyDialog();

                        MessageToast.show("Failed to load data");

                    } finally {

                        this.closeBusyDialog();

                    }
                },
               formatEditDateTime: function (sDateTime) {

    if (!sDateTime) {

        return "";
    }

    // Remove UTC timezone
    sDateTime =
        sDateTime.replace("Z", "");

    // Split Date & Time
    var aSplit =
        sDateTime.split("T");

    if (aSplit.length < 2) {

        return sDateTime;
    }

    // Date
    var sDate =
        aSplit[0];

    // Time
    var sTime =
        aSplit[1].substring(0, 5);

    return sDate + " " + sTime;
},
                ME_onUpdatePress: async function () {

                    var oTable = this.byId("ME_id_Table");

                    var aSelectedItems = oTable.getSelectedItems();

                    if (aSelectedItems.length !== 1) {

                        sap.m.MessageToast.show("Select one record to edit");

                        return;
                    }

                    var oSelectedData = aSelectedItems[0]
                        .getBindingContext("ManageEventModel")
                        .getObject();

                    // Set Existing Data
                    var oEditData = {
                        ID: oSelectedData.ID,
                        EventName: oSelectedData.EventName,
                        TimeSlot: this.formatEditDateTime(oSelectedData.StartDateTime),
                        Content: oSelectedData.Content,
                        Link: oSelectedData.LinkToRegister,
                        Address: oSelectedData.Address,
                        File: oSelectedData.File,
                        FileName: oSelectedData.FileName,
                        FileType: oSelectedData.FileType,
                        IsEdit: true
                    };

                    // Set Event Model
                    var oModel = new JSONModel(oEditData);

                    this.getView().setModel(oModel, "EventModel");

                    // Token Model
                    var aTokens = [];

                    if (oSelectedData.FileName) {

                        aTokens.push({
                            key: oSelectedData.FileName,
                            text: oSelectedData.FileName
                        });
                    }

                    this.getView().getModel("tokenModel")
                        .setProperty("/tokens", aTokens);

                    // Open Fragment
                   if (!this._oEventFragment) {
        this._oEventFragment = await sap.ui.core.Fragment.load({
            id: this.getView().getId(),
            name: "sap.kt.com.minihrsolution.fragment.ManageEvent",
            controller: this
        });
        this.getView().addDependent(this._oEventFragment);
    }

                    this._oEventFragment.open();
                },
                MEF_onsavebuttonpress: async function () {
                    const oData = this.getView()
                        .getModel("EventModel")
                        .getData();

                    // Validation
                    if (
                        utils._LCvalidateMandatoryField(this.byId("MEF_ideventname"), "ID") &&
                        utils._LCvalidateMandatoryField(this.byId("MEF_datetimepicker"), "ID") &&
                        utils._LCvalidateMandatoryField(this.byId("MEF_ideventcontent"), "ID") &&
                        utils._LCvalidateMandatoryField(this.byId("MEF_ideventlink"), "ID")
                        
                    ) {

                    } else {
                        MessageToast.show(
                            this.i18nModel.getText("mandetoryFields")
                        );

                        return;
                    }

                    // Image Validation
                    if (!oData.File) {

                        MessageToast.show("Upload Image");

                        return;
                    }

                    try {

                        this.getBusyDialog();

                        // CREATE PAYLOAD
                        const oPayload = {

                            data: {
                                EventName: oData.EventName,
                                StartDateTime: oData.TimeSlot,
                                Content: oData.Content,
                                LinkToRegister: oData.Link,
                                Address: oData.Address,
                                File: oData.File,
                                FileName: oData.FileName,
                                FileType: oData.FileType
                            }
                        };

                        // EDIT CONDITION
                        if (oData.IsEdit) {

                            // UPDATE PAYLOAD
                            const oUpdatePayload = {

                                data: oPayload.data,

                                filters: {
                                    ID: oData.ID
                                }
                            };

                            await this.ajaxUpdateWithJQuery(
                                "ManageEvent",
                                oUpdatePayload
                            );

                            MessageToast.show(
                                "Event Updated Successfully"
                            );

                        } else {

                            // CREATE CALL
                            await this.ajaxCreateWithJQuery(
                                "ManageEvent",
                                oPayload
                            );
                            // Close Fragment



                            MessageToast.show(
                                "Event Created Successfully"
                            );
                        }

                          if (this._oEventFragment) {
    this._oEventFragment.close();
}
                        // Refresh Table
                        this.ME_getEventData();
                    } catch (oError) {
                       
                        MessageToast.show(
                            "Something went wrong"
                        );

                    } finally {

                        this.closeBusyDialog();
                    }
                },
                ME_onDeletePress: async function () {

                    var oTable = this.byId("ME_id_Table");

                    var aSelectedItems = oTable.getSelectedItems();

                    // Validation
                    if (aSelectedItems.length !== 1) {

                        MessageToast.show(
                            "Select one record to delete"
                        );

                        return;
                    }

                    // Selected Row Data
                    var oSelectedData = aSelectedItems[0]
                        .getBindingContext("ManageEventModel")
                        .getObject();

                    // Confirmation Dialog
                    sap.m.MessageBox.confirm(

                        "Are you sure you want to delete this event?",

                        {
                            title: "Confirm",

                            actions: [
                                sap.m.MessageBox.Action.YES,
                                sap.m.MessageBox.Action.NO
                            ],

                            onClose: async function (sAction) {

                                if (
                                    sAction ===
                                    sap.m.MessageBox.Action.YES
                                ) {

                                    try {

                                        this.getBusyDialog();

                                        // DELETE PAYLOAD
                                        var oPayload = {

                                            filters: {
                                                ID: oSelectedData.ID
                                            }
                                        };

                                        // AJAX DELETE CALL
                                        await this.ajaxDeleteWithJQuery(
                                            "ManageEvent",
                                            oPayload
                                        );

                                        MessageToast.show(
                                            "Event Deleted Successfully"
                                        );

                                        // Refresh Table
                                        this.ME_getEventData();

                                    } catch (oError) {

                                        this.closeBusyDialog();
                                        MessageToast.show(
                                            "Error while deleting"
                                        );

                                    } finally {

                                        this.closeBusyDialog();
                                    }
                                }

                            }.bind(this)
                        }
                    );
                },




                onPressback: function () {
                    this.getRouter().navTo("RouteTilePage");

                },
                onLogout() {
                    this.getRouter().navTo("RouteLoginPage");
                },
            },
        );
    },
);