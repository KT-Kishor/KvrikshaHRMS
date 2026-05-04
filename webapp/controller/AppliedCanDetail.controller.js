sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "../model/formatter"
], function(BaseController,
    JSONModel, formatter) {
    "use strict";
    return BaseController.extend("sap.kt.com.minihrsolution.controller.AppliedCanDetail", {
        formatter: formatter,
        onInit: function() {
            const oViewModel = new JSONModel({
                isEditMode: false
            });
            this.getView().setModel(oViewModel, "viewModel");
            const router = this.getOwnerComponent().getRouter();
            router.getRoute("AppliedCanDetail").attachPatternMatched(this._onObjectMatched, this);
        },
        
        _onObjectMatched: async function(oEvent) {
            this.getView().getModel("viewModel").setProperty("/isEditMode", false);
            var LoginFUnction = await this.commonLoginFunction("Recruitment");
            if (!LoginFUnction) return;
            this.i18na = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            this.getBusyDialog();

            try {
                const userId = oEvent.getParameter("arguments").id;
                this.sUserId = userId;
                const filter = {
                    ID: userId
                };
                const result = await this.ajaxReadWithJQuery("JobApplications", filter);

                if (result?.data?.length > 0) {
                    const candidateData = result.data[0];
                    const formModel = new JSONModel(candidateData);
                    this.getView().setModel(formModel, "setDataToForm");

                    const setDataToForm = this.getView().getModel("setDataToForm");
                    setDataToForm.setProperty("/DOB", this.Formatter.formatDate(candidateData.DOB));
                    setDataToForm.setProperty("/WorkDurationStart", this.Formatter.formatDate(candidateData.WorkDurationStart));
                    setDataToForm.setProperty("/WorkDurationEnd", this.Formatter.formatDate(candidateData.WorkDurationEnd));

                    // Set UploadModel
                    const oUploadModel = new JSONModel({
                        File: candidateData.ResumeFile || "",
                        FileName: candidateData.AttachmentName || "",
                        FileType: candidateData.AttachmentType || ""
                    });
                    this.getView().setModel(oUploadModel, "UploadModel");

                    // Set token if file exists
                    const oTokenModel = new JSONModel({
                        tokens: candidateData.AttachmentName ? [{
                            key: candidateData.AttachmentName,
                            text: candidateData.AttachmentName
                        }] : []
                    });
                    this.getView().setModel(oTokenModel, "tokenModel");
                }

                this.closeBusyDialog();
            } catch (err) {
                this.closeBusyDialog();
                console.error("Read failed:", err);
                sap.m.MessageToast.show("Failed to load application details.");
            }
        },
_applyCountryStateCityFilters: function () {
                const oModel     = this.getView().getModel("setDataToForm");
                const oCountryCB = this.byId("AC_Id_Country");
                const oStateCB   = this.byId("AN_Id_State");
                const oSourceCB  = this.byId("AN_Id_City");
 
                const sCountry   = oModel.getProperty("/Country");     // e.g. "Australia"
                const sState     = oModel.getProperty("/State");       // e.g. "Queensland"
                const sSource    = oModel.getProperty("/City");      // e.g. "Bongaree"
 
                // Reset all filters
                oStateCB.getBinding("items")?.filter([]);
                oSourceCB.getBinding("items")?.filter([]);
 
                if (sCountry) {
                    // Find countryCode by name
                    const aCountryData = this.getView().getModel("CountryModel").getData();
                    const oCountryObj = aCountryData.find(c => c.countryName === sCountry);
 
                    if (oCountryObj) {
                        const sCountryCode = oCountryObj.code;
 
                        // Filter States by Country
                        oStateCB.getBinding("items")?.filter([
                            new sap.ui.model.Filter("countryCode", sap.ui.model.FilterOperator.EQ, sCountryCode)
                        ]);
 
                        if (sState) {
                            // Filter Cities by State + Country
                            const aFilters = [
                                new sap.ui.model.Filter("stateName", sap.ui.model.FilterOperator.EQ, sState),
                                new sap.ui.model.Filter("countryCode", sap.ui.model.FilterOperator.EQ, sCountryCode)
                            ];
                            oSourceCB.getBinding("items")?.filter(aFilters);
                        }
                    }
                }
 
                // Ensure values are set back in UI
                oCountryCB.setValue(sCountry || "");
                oStateCB.setValue(sState || "");
                oSourceCB.setValue(sSource || "");
            },
        ACD_onEditPress: async function() {
            const oViewModel = this.getView().getModel("viewModel");
            const bIsEditMode = oViewModel.getProperty("/isEditMode");
            const oUploadModel = this.getView().getModel("UploadModel");
                 
            const oPayload = {};
             this._applyCountryStateCityFilters()
            if (oUploadModel) {
                const uploadData = oUploadModel.getData();
                oPayload.ResumeFile = uploadData.File || "";
                oPayload.AttachmentName = uploadData.FileName || "";
                oPayload.AttachmentType = uploadData.FileType || "";
            }

            if (bIsEditMode) {
                const oDataToSave = this.getView().getModel("setDataToForm").getData();
                Object.assign(oDataToSave, oPayload);
                if (oDataToSave.DOB) {
                    oDataToSave.DOB = oDataToSave.DOB.split("/").reverse().join("-");
                }
                if (oDataToSave.WorkDurationStart) {
                    oDataToSave.WorkDurationStart = oDataToSave.WorkDurationStart.split("/").reverse().join("-");
                }
                if (oDataToSave.WorkDurationEnd) {
                    oDataToSave.WorkDurationEnd = oDataToSave.WorkDurationEnd.split("/").reverse().join("-");
                }

                this.getBusyDialog();
                try {
                    await this.ajaxUpdateWithJQuery("JobApplications", {
                        data: oDataToSave,
                        filters: {
                            ID: oDataToSave.ID
                        }
                    });
                    sap.m.MessageToast.show("Details saved successfully!");
                    this.closeBusyDialog();
                } catch (error) {
                    sap.m.MessageToast.show(error.message || "Error saving data");
                    this.closeBusyDialog();
                    return;
                }
            }

            oViewModel.setProperty("/isEditMode", !bIsEditMode);
        },

         AC_onChangeCountry: function (oEvent) {
                const oSelectedItem = oEvent.getSource().getSelectedItem();
                const oStateCombo = this.getView().byId("AN_Id_State");
                const oCityCombo  = this.getView().byId("AN_Id_City");
                const oStdCodeInp = this.getView().byId("AC_id_ISD");
                const oModel      = this.getView().getModel("setDataToForm");

                // Reset dependent fields
                oStateCombo.setSelectedKey("");
                oStateCombo.getBinding("items")?.filter([]);
                oCityCombo.setSelectedKey("");
                oCityCombo.getBinding("items")?.filter([]);
                oStdCodeInp.setValue("");

                if (!oSelectedItem) {
                    // reset model
                    oModel.setProperty("/Country", "");
                    oModel.setProperty("/State", "");
                    oModel.setProperty("/City", "");
                    oModel.setProperty("/ISD", "");
                } else {
                    // fetch country data
                    const sCountryCode = oSelectedItem.getAdditionalText(); // "IN"
                    const oCountryData = oSelectedItem.getBindingContext("CountryModel").getObject();
                    const sCountryName = oSelectedItem.getText();

                    // filter states by countryCode
                    oStateCombo.getBinding("items")?.filter([
                        new sap.ui.model.Filter("countryCode", sap.ui.model.FilterOperator.EQ, sCountryCode)
                    ]);

                    // set model props
                    oModel.setProperty("/Country", sCountryName || "");
                    oModel.setProperty("/ISD", oCountryData?.stdCode || "");

                    // reflect in UI
                    oStdCodeInp.setValue(oCountryData?.stdCode || "");
                }
            },

            AC_onChangeState: function (oEvent) {
                const oSelectedItem = oEvent.getSource().getSelectedItem();
                // Controls
                const oCityCombo = this.getView().byId("AN_Id_City");
                const oCountryCB = this.getView().byId("AC_Id_Country");
                const oModel     = this.getView().getModel("setDataToForm");

                // Clear cities
                oCityCombo.setSelectedKey("");
                oCityCombo.getBinding("items")?.filter([]);

                if (!oSelectedItem) {
                    oModel.setProperty("/State", "");
                    oModel.setProperty("/City", "");
                } else {
                    const sStateName   = oSelectedItem.getKey() || oSelectedItem.getText();
                    const sCountryCode = oCountryCB.getSelectedItem()?.getAdditionalText();

                    // filter cities based on state + country
                    oCityCombo.getBinding("items")?.filter([
                        new sap.ui.model.Filter("stateName",   sap.ui.model.FilterOperator.EQ, sStateName),
                        new sap.ui.model.Filter("countryCode", sap.ui.model.FilterOperator.EQ, sCountryCode)
                    ]);

                    oModel.setProperty("/State", sStateName || "");
                }
            },

            AC_onChangeCity: function (oEvent) {
                const oSelectedItem = oEvent.getSource().getSelectedItem();
                const oModel        = this.getView().getModel("setDataToForm");
                if (!oSelectedItem) {
                    oModel.setProperty("/City", "");
                } else {
                    const sCityName = oSelectedItem.getKey() || oSelectedItem.getText();
                    oModel.setProperty("/City", sCityName || "");
                }
            },

        onPageNavButtonPress: function() {
            this.getOwnerComponent().getRouter().navTo("AppliedCandidates",{
                    value: "AppliedCanDetail"
            }); // Navigate to tile page
        },

        onLogout: function() {
            this.CommonLogoutFunction(); // Navigate to login page 
        },

        onDownloadResume: function() {
            const oData = this.getView().getModel("setDataToForm").getData();
            console.log("Resume Data:", oData);

            let base64String = oData.ResumeFile;
            const sFileName = oData.FileName || "Resume";
            const sMimeType = oData.MimeType || "application/octet-stream";

            if (!base64String) {
                sap.m.MessageToast.show("No resume data found.");
                return;
            }

            if (base64String.startsWith("data:")) {
                base64String = base64String.split(",")[1];
            }

            try {
                // Step 2: Decode base64
                const binary = atob(base64String);
                const len = binary.length;
                const buffer = new Uint8Array(len);

                for (let i = 0; i < len; i++) {
                    buffer[i] = binary.charCodeAt(i);
                }

                const blob = new Blob([buffer], {
                    type: sMimeType
                });

                // Step 3: Trigger download
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = sFileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch (e) {
                console.error("Failed to decode Base64:", e);
                sap.m.MessageToast.show("Failed to download resume.");
            }
        },

        openResumePreview: function() {
            const oData = this.getView().getModel("setDataToForm").getData();
            let base64String = oData.ResumeFile;
            const sMimeType = oData.AttachmentType || "application/pdf";
            const sFileName = oData.AttachmentName || "Resume.pdf";

            if (!base64String) {
                sap.m.MessageToast.show("No resume data found.");
                return;
            }

            // Clean base64 if prefixed
            if (base64String.startsWith("data:")) {
                base64String = base64String.split(",")[1];
            }

            // Convert base64 to Blob and get object URL
            const byteCharacters = atob(base64String);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], {
                type: sMimeType
            });
            const blobUrl = URL.createObjectURL(blob);

            // Store blobUrl for cleanup
            this._pdfBlobUrl = blobUrl;

            // Destroy previous dialog if exists
            if (this._oResumeDialog) {
                this._oResumeDialog.destroy();
                this._oResumeDialog = null;
            }

            // Create dialog
            this._oResumeDialog = new sap.m.Dialog({
                title: sFileName,
                stretch: true, // Fullscreen on all devices
                draggable: true,
                resizable: true,
                contentWidth: "80%",
                contentHeight: "80%",
                horizontalScrolling: false,
                contentPadding: "0rem",
                content: [],
                content: [
                    new sap.ui.core.HTML({
                        content: `
                            <div style="width:100%; height:100%;">
                                <iframe 
                                    src="${blobUrl}" 
                                    style="width:100%; height:600px; border:none;">
                                </iframe>
                            </div>
                        `
                    })
                ],
                beginButton: new sap.m.Button({
                    text: "Download",
                    type: "Transparent",
                    press: function() {
                        const downloadLink = document.createElement("a");
                        downloadLink.href = blobUrl;
                        downloadLink.download = sFileName;
                        document.body.appendChild(downloadLink);
                        downloadLink.click();
                        document.body.removeChild(downloadLink);
                    }
                }),
                endButton: new sap.m.Button({
                    text: "Close",
                    type: "Transparent",
                    press: function() {
                        if (this._pdfBlobUrl) {
                            URL.revokeObjectURL(this._pdfBlobUrl);
                            this._pdfBlobUrl = null;
                        }
                        this._oResumeDialog.close();
                        this._oResumeDialog.destroy();
                        this._oResumeDialog = null;
                    }.bind(this)
                })
            });
            this.getView().addDependent(this._oResumeDialog);
            this._oResumeDialog.open();
        },

        ACD_onBoardCandidate: function() {
            var oCandidate = this.getView().getModel("setDataToForm").getData();
            this.getOwnerComponent().getRouter().navTo("RouteEmployeeOfferDetails", {
               sParOffer: "Recruitment",
               sParEmployee:oCandidate.ID
            });
        },

        onFileSizeExceeds: function() {
            MessageToast.show(this.i18nModel.getText("fileSizeExceeds"));
        },

        onBeforeUploadStarts: function(oEvent) {
            const oFile = oEvent.getParameter("files")[0];
            if (!oFile) {
                MessageToast.show("No file selected.");
                return;
            }

            const oModel = this.getView().getModel("tokenModel");
            let aTokens = oModel.getProperty("/tokens") || [];

            if (aTokens.length >= 1) {
                sap.m.MessageBox.error("Only one file can be uploaded at a time.");
                return;
            }

            const reader = new FileReader();
            const that = this;

            reader.onload = function(e) {
                const base64 = e.target.result.split(',')[1];

                that.getView().getModel("UploadModel").setData({
                    File: base64,
                    FileName: oFile.name,
                    FileType: oFile.type
                });

                aTokens.push({
                    key: oFile.name,
                    text: oFile.name
                });
                oModel.setProperty("/tokens", aTokens);
                sap.m.MessageToast.show("File uploaded successfully: " + oFile.name);
            };
            reader.readAsDataURL(oFile);
        },

        onTokenDelete: function(oEvent) {
            const oModel = this.getView().getModel("tokenModel");
            let aTokens = oModel.getProperty("/tokens") || [];
            const aTokensToDelete = oEvent.getParameter("tokens");

            aTokensToDelete.forEach(function(oDeletedToken) {
                const sKey = oDeletedToken.getKey();
                aTokens = aTokens.filter(token => token.key !== sKey);
            });

            oModel.setProperty("/tokens", aTokens);

            if (aTokens.length === 0) {
                const oUploadModel = this.getView().getModel("UploadModel");
                oUploadModel.setData({
                    File: "",
                    FileName: "",
                    FileType: ""
                });
            }
        },

        SalaryInfoPress: function(oEvent) {
            if (!this._oPopover) {
                this._oPopover = new sap.m.Popover({
                    contentWidth: "300px",
                    contentHeight: "auto",
                    showHeader: false,
                    placement: sap.m.PlacementType.Bottom,
                    content: [new sap.m.VBox({
                        alignItems: "Center",
                        justifyContent: "Center",
                        width: "100%",
                        items: [new sap.m.Text({
                            text: this.i18na.getText("salaryPackageInfo"),
                            wrapping: true
                        })]
                    }).addStyleClass("customPopoverContent")]
                });
                this.getView().addDependent(this._oPopover);
            }
            this._oPopover.openBy(oEvent.getSource());
        },
    });
});