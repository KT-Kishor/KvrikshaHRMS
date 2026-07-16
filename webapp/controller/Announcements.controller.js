sap.ui.define(["./BaseController", "sap/ui/model/json/JSONModel", "sap/ui/core/Fragment", "sap/ui/model/Filter", "sap/ui/model/FilterOperator", "sap/m/MessageToast", "sap/m/MessageBox", "../utils/validation", "../model/formatter"], function (BaseController, JSONModel, Fragment, Filter, FilterOperator, MessageToast, MessageBox, utils, Formatter) {
    "use strict";
    return BaseController.extend("sap.kt.com.minihrsolution.controller.Announcements", {
        Formatter: Formatter,
        // =================== LIFECYCLE ===================
        onInit:  function () {
            this._ANC_initModels();
            this._iSearchDebounce = null;
            this._iLoadToken = 0;
            this._bIsAdmin = false;
            this._sUserDepartment = "";
            this._aEmployeeListCache = null;
            this._employeeListPromise = null;
            // Tracks the currently active Blob URL for the PDF viewer so it
            this._sCurrentPdfBlobUrl = null;
            this.getView().setModel(new JSONModel({
                pdfSource: ""
            }), "pdfModel");
            
            this.getRouter().getRoute("NameRouteAnnouncements").attachPatternMatched(this._ANC_onRouteMatched, this);
        },
        // BUSY: shown from route match through login, role/department
        // resolution, and the initial announcement load.
        _ANC_onRouteMatched: async function () {
            var LoginFUnction = await this.commonLoginFunction("Announcement");
            if (!LoginFUnction) return;
            this.getView().getModel("LoginModel").setProperty("/HeaderName", "Announcements");
             const announcementsearch = this.byId("ANC_id_SearchAnnouncement");
            const Announcemntdepartment = this.byId("ANC_id_DepartmentFilter");
                  
            if (Announcemntdepartment) {
                Announcemntdepartment.setSelectedKey("");
                Announcemntdepartment.setValue("");
            }
            if (announcementsearch) {
                announcementsearch.setValue("");
            }
            // this._ViewDatePickersReadOnly(["ANC_id_ExpiresDate"]);
            this.ANC_onSearchAnnouncement() 
           this._sDefaultBackground = await this._getDefaultImageBase64();
            try {
                // ---- Reset ----
                this._bIsAdmin = false;
                this._sUserDepartment = "";
                this._aEmployeeListCache = null;
                this._employeeListPromise = null;
                this.getView().getModel("Announcements").setData({
                    data: []
                });
                this.getView().getModel("ANCView").setData({
                    busy: false,
                    editMode: false,
                    formData: {}
                });
                var oDeptModel = this.getView().getModel("DepartmentModel");
                if (oDeptModel) {
                    oDeptModel.setData([]);
                }
                this.getView().getModel("visibilityModel").setData({
                    showAdminControls: false,
                    showDepartmentFilter: false
                });

                // ---- Resolve current user's role + department from cache ----
                var oLoginModel = this.getView().getModel("LoginModel");
                var sEmployeeID = oLoginModel.getProperty("/EmployeeID");
                // ---- Fetch only logged-in employee ----
                var oCurrentEmp = await this._ANC_getEmployeeList(sEmployeeID);
                var sRole = oCurrentEmp ? (oCurrentEmp.Role || "").toLowerCase().trim() : "";
                var sDepartment = oCurrentEmp ? (oCurrentEmp.Department || "").trim() : "";
                var bIsAdmin = ["admin", "hr", "hr manager"].includes(sRole);
                this._bIsAdmin = bIsAdmin;
                this._sUserDepartment = bIsAdmin ? "" : sDepartment;
                this.i18nModel = this.getView().getModel("i18n").getResourceBundle();
                // ---- Visibility (Create/Edit/Delete + department filter dropdown) ----
                var oVisibilityModel = this.getView().getModel("visibilityModel");
                oVisibilityModel.setProperty("/showAdminControls", bIsAdmin);
                oVisibilityModel.setProperty("/showDepartmentFilter", bIsAdmin);
                // ---- Department dropdown built from the SAME cached list ----
                var oRoleDepartmentModel = this.getOwnerComponent().getModel("RoleDepartmentModel");
                var aDepartments = oRoleDepartmentModel?.getData() || [];

                // Get unique department names
                var aUniqueDepartments = [
                    ...new Set(
                        aDepartments
                            .map(function (oItem) {
                                return (oItem.Department || oItem.department || "").trim();
                            })
                            .filter(Boolean)
                    )
                ];

                // Format for ComboBox/Select binding
                var aData = aUniqueDepartments.map(function (sDepartment) {
                    return {
                        department: sDepartment
                    };
                });

                this.getView().getModel("DepartmentModel").setData(aData);
                // ---- Load announcements ----
                await this.ANC_loadAnnouncements();
            } catch (e) {
                console.error("Route match failed:", e);
            } finally {
                this.closeBusyDialog();
            }
        },
        formatStatusText: function (sStatus) {
            var oResourceBundle = sap.ui.getCore().getLibraryResourceBundle ? this.getOwnerComponent && this.getOwnerComponent().getModel("i18n").getResourceBundle() : null;
            switch (sStatus) {
                case "Draft":
                    return oResourceBundle ? oResourceBundle.getText("StatusDraft") : "Draft";
                case "Published":
                    return oResourceBundle ? oResourceBundle.getText("StatusPublished") : "Published";
                case "Blocked":
                    return oResourceBundle ? oResourceBundle.getText("StatusBlocked") : "Blocked";
                default:
                    return sStatus || "";
            }
        },
        _getDefaultImageBase64: function () {
    return new Promise(function (resolve, reject) {
        var img = new Image();

        img.onload = function () {
            var canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;

            var ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);

            resolve(canvas.toDataURL("image/jpeg").split(",")[1]);
        };

        img.onerror = reject;

        img.src = sap.ui.require.toUrl("sap/kt/com/minihrsolution/image/Blue.jpg");
    });
},
        _ANC_initModels: function () {
            var oDepartmentModel = new JSONModel([]);
            this.getView().setModel(oDepartmentModel, "DepartmentModel");
            var oViewModel = new JSONModel({
                busy: false,
                editMode: false,
                formData: {}
            });
            this.getView().setModel(oViewModel, "ANCView");
            var oListModel = new JSONModel({
                data: []
            });
            this.getView().setModel(oListModel, "Announcements");
            var oVisibilityModel = new JSONModel({
                showAdminControls: false,
                showDepartmentFilter: false
            });
            this.getView().setModel(oVisibilityModel, "visibilityModel");
            var oTodayModel = new JSONModel({
                today: new Date()
            });
            this.getView().setModel(oTodayModel, "todayModel");
        },

        // =================== EMPLOYEE / DEPARTMENT RESOLUTION ===================
        _ANC_getEmployeeList: async function (sEmployeeID) {
            // Return cached employee if already loaded
            if (this._aEmployeeListCache) {
                return this._aEmployeeListCache;
            }
            // Return existing promise if request is already in progress
            if (this._employeeListPromise) {
                return this._employeeListPromise;
            }
            this._employeeListPromise = this.ajaxReadWithJQuery("EmployeeDetails", {
                filters: {
                    EmployeeID: sEmployeeID
                }
            }).then(function (oResponse) {
                var aEmployees = (oResponse && oResponse.data) ? oResponse.data : [];
                // Find exact matching employee
                var oEmployee = aEmployees.find(function (oEmp) {
                    return String(oEmp.EmployeeID).trim() === String(sEmployeeID).trim();
                }) || null;

                this._aEmployeeListCache = oEmployee;
                return oEmployee;
            }.bind(this)).catch(function () {

                this._aEmployeeListCache = null;
                return null;
            }.bind(this)).finally(function () {
                this._employeeListPromise = null;
            }.bind(this));
            return this._employeeListPromise;
        },
        _ANC_buildDepartmentModel: function (aEmployees) {
            var aDepartments = [...new Set(aEmployees.map(function (oEmp) {
                return oEmp.Department;
            }).filter(Boolean))];
            var aData = aDepartments.map(function (sDept) {
                return {
                    department: sDept
                };
            });
            var oModel = new JSONModel(aData);
            this.getView().setModel(oModel, "DepartmentModel");
        },
        // =================== DATE HELPERS ===================
        _ANC_toDateOnly: function (vValue) {
            if (!vValue) {
                return "";
            }
            var oDate;
            if (vValue instanceof Date) {
                oDate = vValue;
            } else if (typeof vValue === "string") {
                var oMatch = /\/Date\((\d+)\)\//.exec(vValue);
                if (oMatch) {
                    oDate = new Date(parseInt(oMatch[1], 10));
                } else if (/^\d{4}-\d{2}-\d{2}$/.test(vValue)) {
                    return vValue;
                } else {
                    oDate = new Date(vValue);
                }
            }
            if (!oDate || isNaN(oDate.getTime())) {
                return "";
            }
            var sYear = oDate.getFullYear();
            var sMonth = String(oDate.getMonth() + 1).padStart(2, "0");
            var sDay = String(oDate.getDate()).padStart(2, "0");
            return sYear + "-" + sMonth + "-" + sDay;
        },
        // =================== LOAD / FILTER ===================
        ANC_loadAnnouncements: async function () {
            var oView = this.getView();
            var oViewModel = oView.getModel("ANCView");
            this._iLoadToken++;
            var iMyToken = this._iLoadToken;
            oViewModel.setProperty("/busy", true);
            this.getBusyDialog();
            try {
                var oDeptFilter = this.byId("ANC_id_DepartmentFilter");
                var sSelectedDepartment = oDeptFilter ? (oDeptFilter.getSelectedKey() || "").toLowerCase().trim() : "";
                var oResult = await this._ANC_readWithRetry({}, 1);
                if (iMyToken !== this._iLoadToken) {

                    return;
                }
                if (!oResult.ok) {

                    MessageToast.show(this.getI18nText("LoadError"));
                    oView.getModel("Announcements").setProperty("/data", []);
                    return;
                }
                var aData = (oResult.data && oResult.data.data) || [];
                var bIsAdmin = this._bIsAdmin;
                var sDepartment = (this._sUserDepartment || "").toLowerCase().trim();
                //==================================================
                // ADMIN / HR / HR MANAGER — everything, optionally
                // narrowed by the department filter dropdown
                //==================================================
                if (bIsAdmin) {

                    if (sSelectedDepartment) {

                        aData = aData.filter(function (oItem) {

                            var sAnnouncementDepartment =
                                (oItem.AnnouncementDepartment || "")
                                    .toLowerCase()
                                    .trim();

                            if (sAnnouncementDepartment === "all") {
                                return true;
                            }

                            return sAnnouncementDepartment
                                .split(",")
                                .map(function (sDept) {
                                    return sDept.trim();
                                })
                                .includes(sSelectedDepartment);

                        });

                    }

                }
                else {

                    var sToday = this._ANC_toDateOnly(new Date());

                    aData = aData.filter(function (oItem) {

                        //==========================
                        // Status must be Published
                        //==========================
                        if ((oItem.AnnouncementStatus || "") !== "Published") {
                            return false;
                        }

                        //==========================
                        // Expiry Date must not be expired
                        //==========================
                        var sExpiryDate = this._ANC_toDateOnly(oItem.ExpiresDate);

                        if (sExpiryDate && sExpiryDate < sToday) {
                            return false;
                        }

                        //==========================
                        // Department Check
                        //==========================
                        var sAnnouncementDepartment =
                            (oItem.AnnouncementDepartment || "")
                                .toLowerCase()
                                .trim();

                        if (sAnnouncementDepartment === "all") {
                            return true;
                        }

                        return sAnnouncementDepartment
                            .split(",")
                            .map(function (sDept) {
                                return sDept.trim();
                            })
                            .includes(sDepartment);

                    }.bind(this));
                }

                oView.getModel("Announcements").setProperty("/data", aData);
                this._ANC_applyClientFilters();
            } catch (e) {
                console.error("Load announcements failed:", e);
            } finally {
                oViewModel.setProperty("/busy", false);
                this.closeBusyDialog();
            }
        },
        ANC_onDepartmentChange: function () {
            this._ANC_readWithRetry(3);
        },
       _ANC_readWithRetry: async function (iRetriesLeft) {
    try {
        const sDepartment = this.byId("ANC_id_DepartmentFilter").getSelectedKey();

        const filter = {};

        if (sDepartment) {
            filter.AnnouncementDepartment = sDepartment;
        }

        const oData = await this.ajaxReadWithJQuery("Announcement", filter);

        return {
            ok: true,
            data: oData
        };

    } catch (e) {
        if (iRetriesLeft > 0) {
            return this._ANC_readWithRetry(iRetriesLeft - 1);
        }

        return {
            ok: false,
            error: e
        };
    }
},
        _ANC_applyClientFilters: function () {
            var oFlexBox = this.byId("ANC_id_AnnouncementFlexBox");
            var oBinding = oFlexBox.getBinding("items");
            if (!oBinding) {
                return;
            }
            var aFilters = [];
            var oSearchField = this.byId("ANC_id_SearchAnnouncement");
            var sQuery = oSearchField.getValue();
            if (sQuery) {
                aFilters.push(new Filter("AnnouncementTitle", FilterOperator.Contains, sQuery));
            }
            oBinding.filter(aFilters);
        },
        ANC_onSearchAnnouncement: function () {
            this.ANC_loadAnnouncements();
        },
        // NOTE: restored the reload call at the end (your pasted version had
        // dropped it) — Clear should re-run the load so the list actually
        // refreshes after fields are cleared.
        ANC_onClearAnnouncement: function () {
            var oSearchField = this.byId("ANC_id_SearchAnnouncement");
            var oDeptFilter = this.byId("ANC_id_DepartmentFilter");
            if (oSearchField) {
                oSearchField.setValue("");
            }
            if (oDeptFilter) {
                oDeptFilter.setSelectedKey("");
            }
        },

        ANC_onLiveSearchAnnouncement: function () {
            this._ANC_applyClientFilters();
        },
        _ANC_patchLocalAnnouncement: function (sId, oPatch) {
            var oModel = this.getView().getModel("Announcements");
            var aData = oModel.getProperty("/data") || [];
            var iIndex = aData.findIndex(function (oItem) {
                return oItem.AnnouncementID === sId;
            });
            if (iIndex === -1) {
                return this.ANC_loadAnnouncements();
            }
            aData[iIndex] = Object.assign({}, aData[iIndex], oPatch);
            oModel.setProperty("/data", aData);
            this._ANC_applyClientFilters();
        },
        _ANC_addLocalAnnouncement: function (oNewItem) {
            var oModel = this.getView().getModel("Announcements");
            var aData = oModel.getProperty("/data") || [];
            aData.unshift(oNewItem);
            oModel.setProperty("/data", aData);
            this._ANC_applyClientFilters();
        },
        _ANC_removeLocalAnnouncement: function (sId) {
            var oModel = this.getView().getModel("Announcements");
            var aData = oModel.getProperty("/data") || [];
            aData = aData.filter(function (oItem) {
                return oItem.AnnouncementID !== sId;
            });
            oModel.setProperty("/data", aData);
            this._ANC_applyClientFilters();
        },
        // =================== CREATE / EDIT DIALOG ===================
        ANC_onCreatePress: function () {
            this._oEditingItem = null;
            this._ANC_openDialog().then(function () {
                this.getView().getModel("ANCView").setProperty("/editMode", false);
                this.getView().getModel("ANCView").setProperty("/formData", {
                    AnnouncementTitle: "",
                    AnnouncementMessage: "",
                    AnnouncementDepartment: "",
                    DepartmentKeys: [],
                    Priority: "Info",
                    AnnouncementStatus: "Draft",
                    ExpiresDate: "",
                    AnnouncementAttachment: null,
                    AnnouncementAttachmentName: "",
                    AnnouncementBackground: null,
                    AnnouncementBackgroundName: ""
                });

            }.bind(this));
        },
        ANC_onEditPress: function (oEvent) {
            var oCtx = oEvent.getSource().getBindingContext("Announcements");
            var oData = Object.assign({}, oCtx.getObject());
            oData.DepartmentKeys = oData.AnnouncementDepartment ? oData.AnnouncementDepartment.split(",").map(function (s) {
                return s.trim();
            }) : [];
            this._oEditingItem = oData;
            this._ANC_openDialog().then(function () {
                this.getView().getModel("ANCView").setProperty("/editMode", true);
                this.getView().getModel("ANCView").setProperty("/formData", {
                    AnnouncementID: oData.AnnouncementID,
                    AnnouncementTitle: oData.AnnouncementTitle,
                    AnnouncementMessage: oData.AnnouncementMessage,
                    DepartmentKeys: oData.DepartmentKeys,
                    AnnouncementDepartment: oData.AnnouncementDepartment,
                    Priority: oData.Priority,
                    AnnouncementStatus: oData.AnnouncementStatus,
                    ExpiresDate: this._ANC_toDateOnly(oData.ExpiresDate),
                    CreatedDate: this._ANC_toDateOnly(oData.CreatedDate),
                    CreatedBy: oData.CreatedBy,
                    AnnouncementAttachment: oData.AnnouncementAttachment,
                    AnnouncementAttachmentName: oData.AnnouncementAttachmentName,
                    AnnouncementBackground: oData.AnnouncementBackground,
                    AnnouncementBackgroundName: oData.AnnouncementBackgroundName
                });
            }.bind(this));
        },
        _ANC_openDialog: function () {
            var oView = this.getView();
            if (this.ANC_oDialog) {
                this.ANC_oDialog.open();
                return Promise.resolve();
            }
            return Fragment.load({
                id: oView.getId(),
                name: "sap.kt.com.minihrsolution.fragment.Fannouncements",
                controller: this
            }).then(function (oDialog) {
                this.ANC_oDialog = oDialog;
                oView.addDependent(oDialog);
                oDialog.open();
            }.bind(this));
        },
        ANC_onCancelPress: function () {
            this._ANC_resetFieldStates();
            this.ANC_oDialog.close();
        },
        _ANC_resetFieldStates: function () {
            var aIds = ["ANC_id_Title", "ANC_id_Description", "ANC_id_Department", "ANC_id_Priority", "ANC_id_Status", "ANC_id_ExpiresDate"];
            aIds.forEach(function (sId) {
                var oControl = this.byId(sId);
                if (oControl) {
                    oControl.setValueState("None");
                }
            }.bind(this));
        },
        // =================== FIELD VALIDATION (LIVE CLEAR) ===================
        ANC_onTitleChange: function (oEvent) {
            utils._LCvalidateMandatoryField(oEvent);
        },
        ANC_onMessageChange: function (oEvent) {
            utils._LCvalidateMandatoryField(oEvent);
        },
        ANC_onDepartmentChange: function (oEvent) {
            utils._LCvalidationMultiComboBox(oEvent);
        },
        ANC_onDateValidation: function (oEvent) {
            var oField = oEvent.getSource();
            var sValue = oField.getValue();
            if (!sValue) {
                oField.setValueState("Error");
                oField.setValueStateText(this.getI18nText("AnnouncementExpiryDateInvalid"));
                return;
            }
            if (!oField.isValidValue()) {
                oField.setValueState("Error");
                oField.setValueStateText(this.getI18nText("AnnouncementExpiryDateInvalid"));
                return;
            }
            oField.setValueState("None");
            oField.setValueStateText("");
        },
        // =================== FILE UPLOAD ===================
       ANC_onAttachmentChange: function (oEvent) {
    const oFile = oEvent.getParameter("files")?.[0];

    if (!oFile) {
        return;
    }

    // Validate file type
    if (oFile.type !== "application/pdf") {
        MessageToast.show(this.getI18nText("InvalidFileType"));
        return;
    }

    const reader = new FileReader();

    reader.onload = function (oEvent) {

        // Remove Data URL prefix
        const sBase64 = oEvent.target.result.split(",")[1];

        // Compress Base64
        const sCompressedBase64 = this.compressBase64(sBase64);

        const oViewModel = this.getView().getModel("ANCView");

        oViewModel.setProperty(
            "/formData/AnnouncementAttachment",
            sCompressedBase64
        );

        oViewModel.setProperty(
            "/formData/AnnouncementAttachmentName",
            oFile.name
        );

        MessageToast.show(this.getI18nText("uploadSuccessfull") || "File selected successfully.");

    }.bind(this);

    reader.onerror = function () {
        MessageToast.show(this.getI18nText("UploadFailed"));
    }.bind(this);

    reader.readAsDataURL(oFile);
},
        ANC_onBackgroundChange: function (oEvent) {
            var oFile = oEvent.getParameter("files") && oEvent.getParameter("files")[0];
            if (!oFile) {
                return;
            }
            if (!/^image\/(png|jpeg)$/.test(oFile.type)) {
                MessageToast.show(this.getI18nText("InvalidFileType"));
                return;
            }
            this.compressAndConvertFile(oFile).then(function (oFileData) {
                var oViewModel = this.getView().getModel("ANCView");
                oViewModel.setProperty("/formData/AnnouncementBackground", oFileData.File);
                oViewModel.setProperty("/formData/AnnouncementBackgroundName", oFileData.FileName);
            }.bind(this)).catch(function (sError) {
                MessageToast.show(sError || this.getI18nText("BackgroundTooLarge"));
            }.bind(this));
        },
        // =================== PDF VIEWER (BLOB URL) ===================
        _ANC_base64ToBlobUrl: function (sBase64, sMimeType) {
            var sCleanBase64 = sBase64.indexOf(",") > -1 ? sBase64.split(",")[1] : sBase64;
            var sByteChars = atob(sCleanBase64);
            var aByteNumbers = new Array(sByteChars.length);
            for (var i = 0; i < sByteChars.length; i++) {
                aByteNumbers[i] = sByteChars.charCodeAt(i);
            }
            var oByteArray = new Uint8Array(aByteNumbers);
            var oBlob = new Blob([oByteArray], {
                type: sMimeType || "application/pdf"
            });
            return URL.createObjectURL(oBlob);
        },
        _ANC_revokeCurrentPdfBlobUrl: function () {
            if (this._sCurrentPdfBlobUrl) {
                URL.revokeObjectURL(this._sCurrentPdfBlobUrl);
                this._sCurrentPdfBlobUrl = null;
            }
        },
        ANC_onClosePDFDialog: function () {
            if (this._oPDFDialog) {
                this._oPDFDialog.close();
            }
            // Free the Blob memory once the dialog is closed — it isn't
            // needed again until the user opens another attachment.
            this._ANC_revokeCurrentPdfBlobUrl();
            this.getView().getModel("pdfModel").setProperty("/pdfSource", "");
        },
        ANC_onBackgroundSizeExceed: function () {
            MessageToast.show(this.getI18nText("BackgroundTooLarge"));
        },
        ANC_onBackgroundTypeMismatch: function () {
            MessageToast.show(this.getI18nText("InvalidFileType"));
        },
        ANC_onAttachmentClear: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            if (sValue) return;
            this.ANC_onRemoveAttachment();
        },
        ANC_onBackgroundClear: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            if (sValue) {
                return;
            }
            this.ANC_onRemoveBackground();
        },
        ANC_onRemoveAttachment: function () {
            var oViewModel = this.getView().getModel("ANCView");
            oViewModel.setProperty("/formData/AnnouncementAttachment", null);
            oViewModel.setProperty("/formData/AnnouncementAttachmentName", "");
            var oUploader = this.byId("ANC_id_AttachmentUploader");
            if (oUploader) {
                oUploader.setValue("");
            }
        },
        ANC_onRemoveBackground: function () {
            var oViewModel = this.getView().getModel("ANCView");
            oViewModel.setProperty("/formData/AnnouncementBackground", null);
            oViewModel.setProperty("/formData/AnnouncementBackgroundName", "");
            var oUploader = this.byId("ANC_id_BackgroundUploader");
            if (oUploader) {
                oUploader.setValue("");
            }
        },
       ANC_onAttachmentPress: function (oEvent) {

    var oContext = oEvent.getSource().getBindingContext("Announcements");

    if (!oContext) {
        MessageToast.show("Binding Context not found.");
        return;
    }

    var sBase64 = oContext.getProperty("AnnouncementAttachment");

    if (!sBase64) {
        MessageToast.show("No attachment found.");
        return;
    }

    // Decompress if stored in compressed format
    if (this.isCompressedBase64(sBase64)) {
        sBase64 = this.decompressBase64(sBase64);
    }

    // Remove Data URL prefix if present
    if (sBase64.startsWith("data:")) {
        sBase64 = sBase64.split(",")[1];
    }

    // Remove whitespace
    sBase64 = sBase64.replace(/\s/g, "");

    this._ANC_revokeCurrentPdfBlobUrl();

    try {
        this._sCurrentPdfBlobUrl = this._ANC_base64ToBlobUrl(
            sBase64,
            "application/pdf"
        );
    } catch (e) {
        console.error(e);
        MessageToast.show(this.getI18nText("LoadError"));
        return;
    }

    if (!this._oPreviewDialog) {

        Fragment.load({
            id: this.getView().getId(),
            name: "sap.kt.com.minihrsolution.fragment.DocumentPreview",
            controller: this
        }).then(function (oDialog) {

            this._oPreviewDialog = oDialog;
            this.getView().addDependent(oDialog);

            this._showPdfPreview();
            this._oPreviewDialog.open();

        }.bind(this));

    } else {

        this._showPdfPreview();
        this._oPreviewDialog.open();
    }
},
        _showPdfPreview: function () {

            var oImage = this.byId("previewImage");
            var oHtml = this.byId("previewHtml");

            oImage.setVisible(false);
            oHtml.setVisible(true);

            const sBlobUrl = this._sCurrentPdfBlobUrl;

            const sIframe =
                "<iframe " +
                "src='" + sBlobUrl + "#toolbar=0&navpanes=0&scrollbar=0' " +
                "width='100%' " +
                "height='100%' " +
                "style='border:none;width:100%;height:100vh;display:block;' " +
                "allowfullscreen>" +
                "</iframe>";

            oHtml.setContent(sIframe);
        },
        onClosePreview: function () {

            if (this._oPreviewDialog) {
                this._oPreviewDialog.close();
            }

            this._ANC_revokeCurrentPdfBlobUrl();
        },
        onDownloadPreview: function () {

            if (!this._sCurrentPdfBlobUrl) {
                return;
            }

            var oLink = document.createElement("a");
            oLink.href = this._sCurrentPdfBlobUrl;
            oLink.download = "Announcement.pdf";
            document.body.appendChild(oLink);
            oLink.click();
            document.body.removeChild(oLink);
        },
        // =================== VIEW / MAXIMIZE DETAIL ===================
        ANC_onViewBackground: function (oEvent) {
            var oButton = oEvent.getSource();
            var oBindingContext = oButton.getBindingContext("Announcements");
            var oView = this.getView();
            if (!this._oDetailDialog) {
                Fragment.load({
                    id: oView.getId(),
                    name: "sap.kt.com.minihrsolution.fragment.AnnouncementDetailDialog",
                    controller: this
                }).then(function (oDialog) {
                    this._oDetailDialog = oDialog;
                    oView.addDependent(oDialog);
                    oDialog.setBindingContext(oBindingContext, "Announcements");
                    oDialog.open();
                    //           this.byId("ANC_id_DetailTitle").focus();

                    //    setTimeout(function () {
                    //      this.byId("ANC_id_ScrollContainer").scrollTo(0, 0, 0);
                    //      }.bind(this), 0);
                }.bind(this));
            } else {
                this._oDetailDialog.setBindingContext(oBindingContext, "Announcements");
                this._oDetailDialog.open();
            }
        },
        ANC_onCloseDetailDialog: function () {
            if (this._oDetailDialog) {
                this._oDetailDialog.close();
            }
        },
        // =================== SAVE / DELETE ===================
        // BUSY: covers both Create and Edit/Update, since both paths run
        // through this single function.
        ANC_onSavePress: async function () {
            var oView = this.getView();
            var oViewModel = oView.getModel("ANCView");
            var oFormData = oViewModel.getProperty("/formData");

            const isValid =
                utils._LCvalidateMandatoryField(this.byId("ANC_id_Title"), "ID") &&
                utils._LCvalidateMandatoryField(this.byId("ANC_id_Description"), "ID") &&
                utils._LCvalidationMultiComboBox(this.byId("ANC_id_Department"), "ID")


            if (!isValid) {
                return MessageToast.show(this.i18nModel.getText("mandetoryFields"));
            }
            var oExpiresDate = this.byId("ANC_id_ExpiresDate");
            var sExpiresValue = oExpiresDate.getValue();
            if (!sExpiresValue) {
                oExpiresDate.setValueState("Error");
                oExpiresDate.setValueStateText(this.getI18nText("AnnouncementExpiryDateInvalid"));
                oExpiresDate.focus();
                return;
            }
            if (!oExpiresDate.isValidValue()) {
                oExpiresDate.setValueState("Error");
                oExpiresDate.setValueStateText(this.getI18nText("AnnouncementExpiryDateInvalid"));
                oExpiresDate.focus();
                return;
            }
            oExpiresDate.setValueState("None");
            oExpiresDate.setValueStateText("");
            if (!oFormData.AnnouncementAttachment) {
                MessageBox.error(this.getI18nText("AnnouncementAttachmentRequired"));
                return;
            }
            // if (!oFormData.AnnouncementBackground) {
            //     MessageBox.error(this.getI18nText("AnnouncementBackgroundRequired"));
            //     return;
            // }
            var bEdit = oViewModel.getProperty("/editMode");
            var oLoginModel = this.getView().getModel("LoginModel");
            var sCurrentUser = oLoginModel ? oLoginModel.getProperty("/EmployeeName") : "Admin";
            var sNormalizedExpiresDate = this._ANC_toDateOnly(sExpiresValue);
            var sToday = this._ANC_toDateOnly(new Date());
            var oData = {
                AnnouncementTitle: oFormData.AnnouncementTitle || "",
                AnnouncementMessage: oFormData.AnnouncementMessage || "",
                AnnouncementDepartment: oFormData.DepartmentKeys && oFormData.DepartmentKeys.length > 0 ? oFormData.DepartmentKeys.join(", ") : "",
                AnnouncementStatus: oFormData.AnnouncementStatus || "",
                Priority: oFormData.Priority || "",
                ExpiresDate: sNormalizedExpiresDate,
                UpdatedBy: sCurrentUser || "",
                AnnouncementAttachment: oFormData.AnnouncementAttachment || "",
                AnnouncementAttachmentName: oFormData.AnnouncementAttachmentName || "",
                AnnouncementBackground: oFormData.AnnouncementBackground || this._sDefaultBackground,
                AnnouncementBackgroundName: oFormData.AnnouncementBackgroundName || "Blue.jpg"
            };
            this.getBusyDialog();
            try {
                if (bEdit) {
                    var sId = oFormData.AnnouncementID;
                    oData.CreatedDate = oFormData.CreatedDate || "";
                    oData.CreatedBy = oFormData.CreatedBy || "";
                    oData.UpdatedDate = sToday;
                    oData.UpdatedBy = sCurrentUser;
                    await this.ajaxUpdateWithJQuery("Announcement", {
                        filters: {
                            AnnouncementID: sId
                        },
                        data: oData
                    });
                    this._ANC_patchLocalAnnouncement(sId, Object.assign({
                        AnnouncementID: sId
                    }, oData));
                } else {
                    oData.CreatedDate = sToday;
                    oData.UpdatedDate = sToday;
                    oData.CreatedBy = sCurrentUser;
                    oData.UpdatedBy = sCurrentUser;
                    var oResponse = await this.ajaxCreateWithJQuery("Announcement", {
                        data: oData
                    });
                    var oCreated = (oResponse && (oResponse.data || oResponse.record || oResponse));
                    if (oCreated && oCreated.AnnouncementID) {
                        this._ANC_addLocalAnnouncement(oCreated);
                    } else {
                        await this.ANC_loadAnnouncements();
                    }
                }
                var aUploaders = this.getView().findAggregatedObjects(true, function (oControl) {
                    return oControl.isA("sap.ui.unified.FileUploader");
                });
                aUploaders.forEach(function (oUploader) {
                    oUploader.clear();
                });
                MessageToast.show(this.getI18nText("AnnouncementSaved"));
                this.ANC_oDialog.close();
            } catch (e) {
                console.error("Save failed:", e);
                MessageToast.show(this.getI18nText("SaveError"));
            } finally {
                this.closeBusyDialog();
            }
        },
        ANC_onDeletePress: function (oEvent) {
            var oCtx = oEvent.getSource().getBindingContext("Announcements");
            var sId = oCtx.getProperty("AnnouncementID");
            this.showConfirmationDialog(this.getI18nText("ConfirmDeleteTitle"), this.getI18nText("ConfirmDeleteMessage"), function () {
                this._ANC_deleteAnnouncement(sId);
            }.bind(this));
        },
        _ANC_deleteAnnouncement: async function (sId) {
            this.getBusyDialog();
            try {
                await this.ajaxDeleteWithJQuery("Announcement", {
                    filters: {
                        AnnouncementID: sId
                    }
                });
                MessageToast.show(this.getI18nText("AnnouncementDeleted"));
                this._ANC_removeLocalAnnouncement(sId);
            } catch (e) {
                console.error("Delete failed:", e);
                MessageToast.show(this.getI18nText("DeleteError"));
            } finally {
                this.closeBusyDialog();
            }
        },
        // =================== FORMATTERS ===================
       ANC_formatBase64Image: function (sBase64) {
            return sBase64 ? "data:image/png;base64," + sBase64 : "";
        },
        ANC_hasValue: function (sValue) {
            return !!sValue;
        },
        ANC_formatSubtitle: function (sDepartment, sCreatedBy) {
            var sDept = sDepartment || "";
            var sBy = sCreatedBy ? this.getI18nText("CreatedBy") + ": " + sCreatedBy : "";
            return [sDept, sBy].filter(Boolean).join(" \u00b7 ");
        },
        // =================== NAVIGATION ===================
        onPressback: function () {
            this.getRouter().navTo("RouteTilePage");

        },
        onLogout: function () {
            this.CommonLogoutFunction();
        },

    });
});