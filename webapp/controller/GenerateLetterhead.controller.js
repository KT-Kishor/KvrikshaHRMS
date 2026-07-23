sap.ui.define(["./BaseController", "sap/m/MessageToast", "sap/ui/core/Fragment", "../utils/validation", "../utils/LetterheadGenerator"], function(BaseController, MessageToast, Fragment, Validation, LetterheadGenerator) {
    "use strict";
    return BaseController.extend("sap.kt.com.minihrsolution.controller.GenerateLetterhead", {
        onInit: function() {
            this.getRouter().getRoute("RouteGeneratePDF").attachPatternMatched(this.GP_onRouteMatched, this);
        },
        GP_onRouteMatched: async function() {
            this.getBusyDialog();
            try {
                if (!await this.commonLoginFunction("GeneratePDF")) {
                    return;
                }
                var oLoginModel = this.getView().getModel("LoginModel");
                if (oLoginModel) {
                    this.oLoginModel = oLoginModel;
                    oLoginModel.setProperty("/HeaderName", this.getI18nText("generateLetterhead"));
                }
                await this._GP_getCompanyCode();
                await this._GP_getCompanyDetails();
            } catch (oError) {
                MessageToast.show(oError.message);
            } finally {
                this.closeBusyDialog();
            }
        },
        // Fetches company master data matched to the logged-in employee's CompanyCode
        _GP_getCompanyDetails: async function() {
           try {
        var oLoginModel = this.oLoginModel;
        var sEmployeeCompanyCode = oLoginModel.getProperty("/CompanyCode");
        var oResponse = await this.ajaxReadWithJQuery("CompanyCodeDetails", {
            companyCode: sEmployeeCompanyCode
        });
        if (!oResponse || !oResponse.data) {
            return;
        }
        // Backend returns only one matching record
        var oMatchedCompany = Array.isArray(oResponse.data)
            ? oResponse.data[0]
            : oResponse.data;
        if (!oMatchedCompany) {
            MessageToast.show("Company details not found.");
            return;
        }
                // Transparent logo variant preferred - baked-in box in companylogo can't be stripped via CSS
                oLoginModel.setProperty("/CompanyLogo", this._bufferToBase64(oMatchedCompany.transparentComplogo || oMatchedCompany.companylogo));
                oLoginModel.setProperty("/CompanySignature", this._bufferToBase64(oMatchedCompany.signature));
                oLoginModel.setProperty("/CompanyName", oMatchedCompany.companyName || "");
                oLoginModel.setProperty("/CompanyAddress", oMatchedCompany.longAddress || "");
                oLoginModel.setProperty("/CompanyBackgroundLogo", this._bufferToBase64(oMatchedCompany.backgroundLogo));
            } catch (oError) {
                MessageToast.show(oError.message);
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
                MessageToast.show("Unable to fetch Company Code");
            }
        },

        GP_onSearch: function() {
            MessageToast.show("Search executed");
        },

        GP_onClear: function() {
            this.byId("GP_id_EmployeeName").setValue("");
        },

        GP_onOpenGeneratePDFDialog: function() {
            var oView = this.getView();
            if (!this.GP_oDialog) {
                Fragment.load({
                    id: oView.getId(),
                    name: "sap.kt.com.minihrsolution.fragment.GenerateLetterheadDialog",
                    controller: this
                }).then(function(oDialog) {
                    this.GP_oDialog = oDialog;
                    oView.addDependent(oDialog);
                    this._GP_resetDialogFields();
                    oDialog.open();
                }.bind(this));
            } else {
                this._GP_resetDialogFields();
                this.GP_oDialog.open();
            }
        },

        GP_onCloseDialog: function() {
            this.GP_oDialog.close();
        },

        _GP_resetDialogFields: function() {
            this.byId("GPD_id_ReferenceNumber").setValue("");
            this.byId("GPD_id_Date").setValue("");
            this.byId("GPD_id_Subject").setValue("");
            this.byId("GPD_id_Content").setValue("");
            this.byId("GPD_id_IncludeSignature").setSelected(true);

            this.byId("GPD_id_ReferenceNumber").setValueState("None");
            this.byId("GPD_id_ReferenceNumber").setValueStateText("");
            this.byId("GPD_id_Date").setValueState("None");
            this.byId("GPD_id_Date").setValueStateText("");
            this.byId("GPD_id_Subject").setValueState("None");
            this.byId("GPD_id_Subject").setValueStateText("");
            this.byId("GPD_id_Content").removeStyleClass("GPErrorBorder");
        },

        _GP_getDialogData: function() {
            return {
                referenceNumber: this.byId("GPD_id_ReferenceNumber").getValue(),
                date: this.byId("GPD_id_Date").getValue(),
                subject: this.byId("GPD_id_Subject").getValue(),
                content: this.byId("GPD_id_Content").getValue(),
                includeSignature: this.byId("GPD_id_IncludeSignature").getSelected()
            };
        },

        _GP_validateForm: function() {
            var oDatePicker = this.byId("GPD_id_Date");
            if (!Validation._LCvalidateDate(this.byId("GPD_id_Date"), "ID")) {
                oDatePicker.setValueState("Error");
        oDatePicker.setValueStateText(
            "Please select a valid date."
        );
                return false;
            }
            var oEditor = this.byId("GPD_id_Content");
            var sPlainText = oEditor.getValue().replace(/<[^>]*>/g, "").trim();
            if (!sPlainText) {
                oEditor.addStyleClass("GPErrorBorder");
                MessageToast.show("Please enter the content for the PDF.");
                return false;
            }
            return true;
        },

        // GP_onSubjectLiveChange: function(oEvent) {
        //     var oInput = oEvent.getSource();
        //     if (oInput.getValue().trim()) {
        //         oInput.setValueState("None");
        //         oInput.setValueStateText("");
        //     }
        // },

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
                    backgroundLogo: oLoginModel.getProperty("/CompanyBackgroundLogo")
                };
                await LetterheadGenerator.generatePDF(mData, mCompanyInfo);
                MessageToast.show(sMessage);
                // this.GP_oDialog.close();
            } catch (oError) {
                MessageToast.show("Error generating PDF : " + oError.message);
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

       GP_onDateChange: function(oEvent) {
            var oDatePicker = oEvent.getSource();
            Validation._LCvalidateDate(oEvent);
            if (oDatePicker.getValueState() === "Error") {
        oDatePicker.setValueStateText("Please select a valid date.");
    }
        },

        GP_onGeneratePDF: function() {
            if (this._GP_validateForm()) {
                this._GP_runGeneratePDF("PDF Generated Successfully");
            }
        },

        onPressback: function() {
            this.getRouter().navTo("RouteTilePage");
        },

        onLogout: function() {
            this.CommonLogoutFunction();
        }
    });
});
