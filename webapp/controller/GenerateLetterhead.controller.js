sap.ui.define(["./BaseController", "sap/m/MessageToast", "sap/ui/core/Fragment", "../utils/validation", "../utils/LetterheadGenerator", "../model/formatter", "sap/ui/model/Filter", "sap/ui/model/FilterOperator"], function(BaseController, MessageToast, Fragment, Validation, LetterheadGenerator, formatter, Filter, FilterOperator) {
    "use strict";
    return BaseController.extend("sap.kt.com.minihrsolution.controller.GenerateLetterhead", {
        formatter: formatter,
        onInit: function() {
            this._oSelectedLetterhead = null;
            this._oSearchField = null;
            this.getRouter().getRoute("RouteGeneratePDF").attachPatternMatched(this.GP_onRouteMatched, this);
            this.getView().setModel(new sap.ui.model.json.JSONModel({
                Count: 0
            }), "GPCountModel");
            var oTable = this.byId("GP_id_LetterheadTable");
            if (oTable) {
                oTable.attachUpdateFinished(function(oEvent) {
                    this.getView().getModel("GPCountModel").setProperty("/Count", oTable.getBinding("items").getLength());
                }.bind(this));
            }
        },
        onExit: function() {
            this.getRouter().getRoute("RouteGeneratePDF").detachPatternMatched(this.GP_onRouteMatched, this);
            if (this.GP_oDialog) {
                this.GP_oDialog.destroy();
                this.GP_oDialog = null;
            }
        },
        GP_onRouteMatched: async function() {
            this.getBusyDialog();
            try {
                if (!await this.commonLoginFunction("GeneratePDF")) return;
                this.getBusyDialog();
                var oLoginModel = this.getView().getModel("LoginModel");
                if (oLoginModel) {
                    this.oLoginModel = oLoginModel;
                    oLoginModel.setProperty("/HeaderName", this.getI18nText("generateLetterhead"));
                }
                this._GP_resetSearchState();
                await this._GP_getCompanyCode();
                await Promise.all([
                    this._GP_getCompanyDetails(),
                    this._GP_getLetterheadList()
                ]);
            } catch (oError) {
                MessageToast.show(oError.message);
            } finally {
                this.closeBusyDialog();
            }
        },
        _GP_resetSearchState: function() {
            if (this._oSearchField) {
                this._oSearchField.setValue("");
            }
            if (this._oLetterheadSelect) {
                this._oLetterheadSelect.setSelectedKey("");
            }
            this._sSearchValue = "";
            this._sSelectedLetterhead = "";
            var oTable = this.byId("GP_id_LetterheadTable");
            var oBinding = oTable && oTable.getBinding("items");
            if (oBinding) {
                oBinding.filter([]);
            }
            if (oTable) {
                oTable.removeSelections(true);
            }
            this._oSelectedLetterhead = null;
        },
        _GP_getCompanyDetails: function() {
            try {
                var oLoginModel = this.oLoginModel;
                var sCompanyCode = oLoginModel.getProperty("/CompanyCode");
                var oCompanyModel = this.getOwnerComponent().getModel("CompanyCodeDetailsModel");
                var aCompanies = oCompanyModel.getData();
                var oMatchedCompany = aCompanies.find(function(oItem) {
                    return oItem.companyCode === sCompanyCode;
                });
                if (!oMatchedCompany) {
                    MessageToast.show(this.getI18nText("companyDetailsNotFound"));
                    return;
                }
                oLoginModel.setProperty("/CompanyLogo", this._bufferToBase64(oMatchedCompany.transparentComplogo));
                oLoginModel.setProperty("/CompanySignature", this._bufferToBase64(oMatchedCompany.signature));
                oLoginModel.setProperty("/CompanyName", oMatchedCompany.companyName || "");
                oLoginModel.setProperty("/CompanyAddress", oMatchedCompany.longAddress || "");
                oLoginModel.setProperty("/CompanyBackgroundLogo", this._bufferToBase64(oMatchedCompany.backgroundLogo));
                oLoginModel.setProperty("/CompanyColor", oMatchedCompany.colorCode);
                oLoginModel.setProperty("/CompanyFontFamily", oMatchedCompany.fontFamily || "Montserrat");
                oLoginModel.setProperty("/CompanyTitleFontSize", oMatchedCompany.titleFontSize || "23px");
                oLoginModel.setProperty("/CompanyAddressFontSize", oMatchedCompany.addressFontSize || "18px");
                oLoginModel.setProperty("/CompanyTitleMarginTop", oMatchedCompany.titleMarginTop || "16px");
                oLoginModel.setProperty("/CompanyAddressMarginTop", oMatchedCompany.addressMarginTop || "12px");
            } catch (oError) {
                MessageToast.show(oError.message);
            }
        },
        GP_onLiveSearch: function(oEvent) {
            var sValue = oEvent.getParameter("value");
            var oTable = this.byId("GP_id_LetterheadTable");
            var oBinding = oTable.getBinding("items");
            this._oSearchField = oEvent.getSource();
            if (!sValue) {
                oBinding.filter([]);
                return;
            }
            var oFilter = new Filter("LetterheadFileName", FilterOperator.Contains, sValue);
            oBinding.filter([oFilter]);
        },
        GP_onLetterheadFilterChange: function(oEvent) {
            var oSelect = oEvent.getSource();
            this._oLetterheadSelect = oSelect;
            this._sSelectedLetterhead = oSelect.getSelectedKey();
        },
        _GP_applyCombinedFilters: function() {
            var oTable = this.byId("GP_id_LetterheadTable");
            var oBinding = oTable && oTable.getBinding("items");
            if (!oBinding) {
                return;
            }
            var aFilters = [];
            if (this._sSearchValue) {
                aFilters.push(new Filter("LetterheadFileName", FilterOperator.Contains, this._sSearchValue));
            }
            if (this._sSelectedLetterhead) {
                aFilters.push(new Filter("LetterheadFileName", FilterOperator.EQ, this._sSelectedLetterhead));
            }
            oBinding.filter(aFilters);
        },
        GP_onFileNameLiveChange: function(oEvent) {
            var oInput = oEvent.getSource();
            if (oInput.getValue().trim()) {
                oInput.setValueState("None");
                oInput.setValueStateText("");
            }
        },
        _GP_getCompanyCode: async function() {
            try {
                var oLoginModel = this.oLoginModel;
                var oResponse = await this.ajaxReadWithJQuery("LoginDetails", {
                    EmployeeID: oLoginModel.getProperty("/EmployeeID")
                });
                if (oResponse && oResponse.data) {
                    var oData = Array.isArray(oResponse.data) ? oResponse.data[0] : oResponse.data;
                    oLoginModel.setProperty("/CompanyCode", oData.CompanyCode);
                }
            } catch (oError) {
                MessageToast.show(this.getI18nText("unableToFetchCompanyCode"));
            }
        },
        _GP_getLetterheadList: async function() {
            try {
                var oResponse = await this.ajaxReadWithJQuery("Letterhead");
                if (!oResponse || !oResponse.data) {
                    return;
                }
                var oView = this.getView();
                var oModel = oView.getModel("LetterheadModel");
                if (oModel) {
                    oModel.setData(oResponse.data);
                } else {
                    oView.setModel(new sap.ui.model.json.JSONModel(oResponse.data), "LetterheadModel");
                }
                this._GP_buildLetterheadNamesModel(oResponse.data);
                sap.ui.getCore().applyChanges();
            } catch (oError) {
                MessageToast.show(oError.message);
            }
        },
        _GP_buildLetterheadNamesModel: function(aData) {
            var oView = this.getView();
            var oNamesModel = oView.getModel("LetterheadNamesModel");
            var aUnique = Array.from(new Set(
                (aData || []).map(function(oItem) {
                    return oItem.LetterheadFileName;
                }).filter(Boolean))).sort();
            var aItems = aUnique.map(function(sName) {
                return {
                    key: sName,
                    text: sName
                };
            });
            if (oNamesModel) {
                oNamesModel.setData(aItems);
            } else {
                oView.setModel(new sap.ui.model.json.JSONModel(aItems), "LetterheadNamesModel");
            }
        },
        GP_onRowSelectionChange: function() {
            var oTable = this.byId("GP_id_LetterheadTable");
            var aSelectedItems = oTable.getSelectedItems();
            this._aSelectedLetterheads = aSelectedItems.map(function(oItem) {
                return oItem.getBindingContext("LetterheadModel").getObject();
            });
            this._oSelectedLetterhead = this._aSelectedLetterheads.length === 1 ? this._aSelectedLetterheads[0] : null;
        },
        GP_onDeleteLetterhead: function() {
            if (!this._aSelectedLetterheads || this._aSelectedLetterheads.length === 0) {
                MessageToast.show(this.getI18nText("MessageNoRowSelected"));
                return;
            }
            sap.m.MessageBox.confirm(this.getI18nText("confirmDeleteMessageResource"), {
                title: this.getI18nText("confirm"),
                onClose: function(sAction) {
                    if (sAction === sap.m.MessageBox.Action.OK) {
                        this._GP_deleteSelectedLetterheads();
                    }
                }.bind(this)
            });
        },
        _GP_deleteSelectedLetterheads: async function() {
            this.getBusyDialog();
            try {
                var aIds = this._aSelectedLetterheads.map(function(o) {
                    return o.ID;
                });
                await Promise.all(aIds.map(function(sId) {
                    return this.ajaxDeleteWithJQuery("Letterhead", {
                        filters: {
                            ID: sId
                        }
                    });
                }.bind(this)));
                MessageToast.show(this.getI18nText("dataDelteSucces"));
                this._aSelectedLetterheads = [];
                this._oSelectedLetterhead = null;
                var oTable = this.byId("GP_id_LetterheadTable");
                if (oTable) {
                    oTable.removeSelections(true);
                }
                await this._GP_getLetterheadList();
            } catch (oError) {
                MessageToast.show(oError.message);
            } finally {
                this.closeBusyDialog();
            }
        },
        GP_onSearch: async function() {
            this.getBusyDialog();
            try {
                await this._GP_getLetterheadList();
                this._GP_applyCombinedFilters();
                this.byId("GP_id_EmployeeName").setValue("");
                this._sSearchValue = "";
            } catch (oError) {
                console.error("Search error:", oError);
                MessageToast.show(oError.message);
            } finally {
                this.closeBusyDialog();
            }
        },
        GP_onClear: function() {
            this.byId("GP_id_EmployeeName").setValue("");
            var oSelect = this.byId("GP_id_LetterheadSelect");
            if (oSelect) {
                oSelect.setSelectedKey("");
            }
            this._sSearchValue = "";
            this._sSelectedLetterhead = "";
        },
        GP_onOpenGeneratePDFDialog: function() {
            if (this._aSelectedLetterheads && this._aSelectedLetterheads.length > 1) {
                MessageToast.show(this.getI18nText("selectOnlyOneRowForGeneratePDF"));
                return;
            }
            var oView = this.getView();
            var fnOpen = function() {
                if (this._oSelectedLetterhead) {
                    this._GP_fillDialog(this._oSelectedLetterhead);
                } else {
                    this._GP_resetDialogFields();
                }
                this.GP_oDialog.open();
            }.bind(this);
            if (!this.GP_oDialog) {
                Fragment.load({
                    id: oView.getId(),
                    name: "sap.kt.com.minihrsolution.fragment.GenerateLetterheadDialog",
                    controller: this
                }).then(function(oDialog) {
                    this.GP_oDialog = oDialog;
                    oView.addDependent(oDialog);
                    this._FragmentDatePickersReadOnly([
                        this.getView().createId("GPD_id_Date")
                    ]);
                    fnOpen();
                }.bind(this));
            } else {
                this._FragmentDatePickersReadOnly([
                    this.getView().createId("GPD_id_Date")
                ]);
                fnOpen();
            }
        },
        GP_onCloseDialog: function() {
            this._GP_closeDialogAndResetSelection();
        },
        _GP_closeDialogAndResetSelection: function() {
            if (this.GP_oDialog) {
                this.GP_oDialog.close();
            }
            this._oSelectedLetterhead = null;
            var oTable = this.byId("GP_id_LetterheadTable");
            if (oTable) {
                oTable.removeSelections(true);
            }
        },
        _GP_resetDialogFields: function() {
            this.byId("GPD_id_ReferenceNumber").setValue("");
            this.byId("GPD_id_Date").setValue("");
            this.byId("GPD_id_To").setValue("");
            this.byId("GPD_id_Subject").setValue("");
            this.byId("GPD_id_Content").setValue("");
            this.byId("GPD_id_FileName").setValue("");
            this.byId("GPD_id_IncludeSignature").setSelected(true);
            this.byId("GPD_id_ReferenceNumber").setValueState("None");
            this.byId("GPD_id_ReferenceNumber").setValueStateText("");
            this.byId("GPD_id_Date").setValueState("None");
            this.byId("GPD_id_Date").setValueStateText("");
            this.byId("GPD_id_Subject").setValueState("None");
            this.byId("GPD_id_Subject").setValueStateText("");
            this.byId("GPD_id_FileName").setValueState("None");
            this.byId("GPD_id_FileName").setValueStateText("");
            this.byId("GPD_id_Content").removeStyleClass("GPErrorBorder");
        },
        _GP_fillDialog: function(oData) {
            this.byId("GPD_id_ReferenceNumber").setValue(oData.ReferenceNumber || "");
            this.byId("GPD_id_Date").setValue(oData.Date ? this.formatter.formatDate(oData.Date) : "");
            this.byId("GPD_id_FileName").setValue(oData.LetterheadFileName || "");
            this.byId("GPD_id_To").setValue(oData.LetterheadTo || "");
            this.byId("GPD_id_Subject").setValue(oData.LetterheadSubject || "");
            this.byId("GPD_id_Content").setValue(oData.LetterheadContent || "");
            this.byId("GPD_id_IncludeSignature").setSelected(oData.SignatureCheckbox === 1);
            this.byId("GPD_id_FileName").setValueState("None");
            this.byId("GPD_id_FileName").setValueStateText("");
            this.byId("GPD_id_Date").setValueState("None");
            this.byId("GPD_id_Date").setValueStateText("");
            this.byId("GPD_id_Content").removeStyleClass("GPErrorBorder");
        },
        _GP_getDialogData: function() {
            return {
                referenceNumber: this.byId("GPD_id_ReferenceNumber").getValue(),
                date: this.byId("GPD_id_Date").getValue(),
                fileName: this.byId("GPD_id_FileName").getValue(),
                to: this.byId("GPD_id_To").getValue(),
                subject: this.byId("GPD_id_Subject").getValue(),
                content: this.byId("GPD_id_Content").getValue(),
                includeSignature: this.byId("GPD_id_IncludeSignature").getSelected()
            };
        },
        _GP_validateForm: function() {
            // Date Validation
            var oDatePicker = this.byId("GPD_id_Date");
            if (!Validation._LCvalidateDate(oDatePicker, "ID")) {
                oDatePicker.setValueState("Error");
                oDatePicker.setValueStateText(this.getI18nText("plaeseSelectDate"));
                return false;
            }
            // Letterhead File Name Validation
            var oFileName = this.byId("GPD_id_FileName");
            if (!Validation._LCvalidateMandatoryField(oFileName, "ID")) {
                oFileName.setValueStateText(this.getI18nText("pleaseEnterLetterheadFileName"));
                return false;
            }
            // Content Validation
            var oEditor = this.byId("GPD_id_Content");
            var sPlainText = oEditor.getValue().replace(/<[^>]*>/g, "").trim();
            if (!sPlainText) {
                oEditor.addStyleClass("GPErrorBorder");
                MessageToast.show(this.getI18nText("pleaseEnterContentForPdf"));
                return false;
            } else {
                oEditor.removeStyleClass("GPErrorBorder");
            }
            return true;
        },
        GP_onDateChange: function(oEvent) {
            var oDatePicker = oEvent.getSource();
            Validation._LCvalidateDate(oEvent);
            if (oDatePicker.getValueState() === "Error") {
                oDatePicker.setValueStateText(this.getI18nText("plaeseSelectDate"));
            }
        },
        GP_onGeneratePDF: function() {
            if (this._GP_validateForm()) {
                this._GP_runGeneratePDF(this.getI18nText("pdfGeneratedSuccessfully"));
            }
        },
        GP_onSaveGeneratePDF: async function() {
            if (!this._GP_validateForm()) {
                return;
            }
            this.getBusyDialog();
            try {
                var bIsUpdate = !!this._oSelectedLetterhead;
                await this._GP_persistLetterhead(bIsUpdate);
                await this._GP_runGeneratePDF(bIsUpdate ? this.getI18nText("letterheadUpdatedAndPdfGenerated") : this.getI18nText("letterheadSavedAndPdfGenerated"));
                await this._GP_getLetterheadList();
            } catch (oError) {
                MessageToast.show(oError.message);
            } finally {
                this.closeBusyDialog();
                this._GP_closeDialogAndResetSelection();
            }
        },
        _GP_persistLetterhead: function(bIsUpdate) {
            var mData = this._GP_getDialogData();
            if (bIsUpdate) {
                return this.ajaxUpdateWithJQuery("Letterhead", {
                    filters: {
                        ID: this._oSelectedLetterhead.ID
                    },
                    data: {
                        ReferenceNumber: mData.referenceNumber,
                        Date: this._formatDateForDB(mData.date),
                        LetterheadFileName: mData.fileName,
                        LetterheadTo: mData.to,
                        LetterheadSubject: mData.subject,
                        SignatureCheckbox: mData.includeSignature ? 1 : 0,
                        LetterheadContent: mData.content
                    }
                });
            }
            return this.ajaxCreateWithJQuery("Letterhead", {
                data: {
                    ID: crypto.randomUUID(),
                    ReferenceNumber: mData.referenceNumber,
                    Date: this._formatDateForDB(mData.date),
                    LetterheadFileName: mData.fileName,
                    LetterheadTo: mData.to,
                    LetterheadSubject: mData.subject,
                    SignatureCheckbox: mData.includeSignature ? 1 : 0,
                    LetterheadContent: mData.content
                }
            });
        },
        _formatDateForDB: function(sDate) {
            if (!sDate) {
                return "";
            }
            var aParts = sDate.split("/"); // dd/MM/yyyy
            return aParts[2] + "-" + aParts[1] + "-" + aParts[0];
        },
        _GP_runGeneratePDF: async function(sMessage) {
            this.getBusyDialog();
            try {
                var mData = this._GP_getDialogData();
                var oLoginModel = this.oLoginModel;
                var mCompanyInfo = {
                    companyName: oLoginModel.getProperty("/CompanyName"),
                    address: oLoginModel.getProperty("/CompanyAddress"),
                    logo: oLoginModel.getProperty("/CompanyLogo"),
                    signature: oLoginModel.getProperty("/CompanySignature"),
                    backgroundLogo: oLoginModel.getProperty("/CompanyBackgroundLogo"),
                    colorCode: oLoginModel.getProperty("/CompanyColor"),
                    fontFamily: oLoginModel.getProperty("/CompanyFontFamily"),
                    titleFontSize: oLoginModel.getProperty("/CompanyTitleFontSize"),
                    addressFontSize: oLoginModel.getProperty("/CompanyAddressFontSize"),
                    titleMarginTop: oLoginModel.getProperty("/CompanyTitleMarginTop"),
                    addressMarginTop: oLoginModel.getProperty("/CompanyAddressMarginTop")
                };
                await LetterheadGenerator.generatePDF(mData, mCompanyInfo);
                MessageToast.show(sMessage);
            } catch (oError) {
                MessageToast.show(this.getI18nText("errorGeneratingPDF") + " " + oError.message);
            } finally {
                this.closeBusyDialog();
            }
        },
        _bufferToBase64: function(oBuffer) {
            if (!oBuffer || !oBuffer.data) {
                return "";
            }
            var aBytes = oBuffer.data;
            var sBinary = "";
            for (var i = 0; i < aBytes.length; i++) {
                sBinary += String.fromCharCode(aBytes[i]);
            }
            return window.btoa(sBinary);
        },
        onPressback: function() {
            this.getRouter().navTo("RouteTilePage");
        },
        onLogout: function() {
            this.CommonLogoutFunction();
        }
    });
});