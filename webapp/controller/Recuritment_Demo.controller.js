sap.ui.define([
    "./BaseController",
    "../utils/validation",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "../model/formatter",
], function(
    BaseController, utils, JSONModel, MessageToast, Formatter
) {
    "use strict";
    return BaseController.extend("sap.kt.com.minihrsolution.controller.Recuritment_Demo", {
        Formatter: Formatter,
        onInit: function() {
            this.getRouter().getRoute("Recruitment_Demo").attachMatched(this._onRouteMatched, this);
            // Form Data
            var oFormData = new JSONModel({
                CustomerName: "",
                CompanyName: "",
                Email: "",
                Address: "",
                TimeSlot: "",
                stdCode: "+91",
                MobileNo: "",
                Comments: ""
            });
            this.getView().setModel(oFormData, "formData");
            // Load carousel videos etc. when route matches
            this._careerDataLoaded = false; // flag to avoid repeated fetch
        },
        _onRouteMatched: function() {
            this.i18nModel = this.getView().getModel("i18n").getResourceBundle();
            //   sessionStorage.removeItem("homePageReturnTab");
            this.API = "https://rest.kalpavrikshatechnologies.com";
        },
        onpresshome: function() {
            const oAppStateModel = this.getOwnerComponent().getModel("AppStateModel");
            const sTabKey = oAppStateModel?.getProperty("/previousTab") || "idHome";

            this.getOwnerComponent().getRouter().navTo("RouteHomePage");

            sessionStorage.setItem("homePageReturnTab", sTabKey);
            this.getOwnerComponent().getRouter().navTo("RouteHomePage");
        },
        onOpenDemoForm: function() {
            if (!this._oDemoFormDialog) {
                this._oDemoFormDialog = sap.ui.xmlfragment(
                    this.getView().getId(), "sap.kt.com.minihrsolution.fragment.NewDemoform",
                    this
                );
                this.getView().addDependent(this._oDemoFormDialog);
            }
            this.byId("idCompanyname").setValueState("None");
            this.byId("idcustomername").setValueState("None");
            this.byId("idCustmailid").setValueState("None");
            this.byId("idtimeslot").setValueState("None");
            this.byId("idDemoSTD").setValueState("None");
            this.byId("idmobilenumber").setValueState("None");
            this.byId("idCustaddress").setValueState("None");
            this.byId("idcomment").setValueState("None");
            this._oDemoFormDialog.open();
        },
        onCloseDemoForm: function() {
            if (this._oDemoFormDialog) {
                this._oDemoFormDialog.close();
            }
        },
        validateCompnayname: function(oEvent) {
            utils._LCvalidateMandatoryField(oEvent);
        },
        validateName: function(oEvent) {
            utils._LCvalidateName(oEvent);
        },
        validateMobileNo: function(oEvent) {
            utils._LCvalidateMobileNumber(oEvent);
        },
        validateEmail: function(oEvent) {
            utils._LCvalidateEmail(oEvent);
        },
        ValidateCommonFields: function(oEvent) {
            utils._LCvalidateMandatoryField(oEvent);
        },
        ValidateSTDFields: function(oEvent) {
            utils._LCstrictValidationComboBox(oEvent);
        },
        onDemoformSave: function() {
            var that = this;
            var oModel = this.getView().getModel("formData");
            var oData = JSON.parse(JSON.stringify(oModel.getData())); // Deep copy to avoid reference issues
            var payload = [oData];

            // Form Validation
            if (
                utils._LCvalidateMandatoryField(this.byId("idCompanyname"), "ID") &&
                utils._LCvalidateName(this.byId("idcustomername"), "ID") &&
                utils._LCvalidateEmail(this.byId("idCustmailid"), "ID") &&
                utils._LCvalidateMandatoryField(this.byId("idtimeslot"), "ID") &&
                utils._LCstrictValidationComboBox(this.byId("idDemoSTD"), "ID") &&
                utils._LCvalidateMobileNumber(this.byId("idmobilenumber"), "ID") &&
                utils._LCvalidateMandatoryField(this.byId("idCustaddress"), "ID") &&
                utils._LCvalidateMandatoryField(this.byId("idcomment"), "ID")
            ) {
                // AJAX Call to Save Data
                $.ajax({
                    url: this.API + "/CustomerDemo",
                    type: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        name: "$2a$12$LC.eHGIEwcbEWhpi9gEA.umh8Psgnlva2aGfFlZLuMtPFjrMDwSui",
                        password: "$2a$12$By8zKifvRcfxTbabZJ5ssOsheOLdAxA2p6/pdaNvv1xy1aHucPm0u",
                    },
                    data: JSON.stringify(payload),
                    success: function(response) {
                        var resetData = {
                            CustomerName: "",
                            CompanyName: "",
                            Email: "",
                            Address: "",
                            TimeSlot: "",
                            MobileNo: "",
                            Comments: "",
                        };

                        oModel.setData(resetData);
                        oModel.refresh(true);

                        that._oDemoFormDialog.close();

                        MessageToast.show("Thanks For Submitting the form. Our team will get back to you soon!");
                        this.getView().getModel("formData").refresh(true);
                        // AJAX Call to Send Email
                    },
                    error: function(xhr, status, error) {
                        MessageToast.show("Error saving data. Please try again.");
                    },
                });
            } else {
                MessageToast.show(this.i18nModel.getText("mandetoryFields"));
            }
        },
        onAfterRendering: function() {
            this._applyResponsiveVideo("videoBox-1", "videoFrameHtml-1", "../Videos/Job Posting.mp4");
            this._applyResponsiveVideo("videoBox-2", "videoFrameHtml-2", "../Videos/Apply Job.mp4");
            // this._applyResponsiveVideo("videoBox-3", "videoFrameHtml-3", "../Videos/Create Quotation Application.mp4");
            // this._applyResponsiveVideo("videoBox-4", "videoFrameHtml-4", "../Videos/Create Quotation Application.mp4");
        },

        _applyResponsiveVideo: function(vBoxId, htmlId, videoUrl) {
            var oHtml = this.byId(htmlId);
            if (!oHtml) return;

            var bAutoplay = (vBoxId === "videoBox-1");

            // Video tag
            var sVideoTag = "<video id='" + htmlId + "_video' controls " +
                (bAutoplay ? "autoplay muted playsinline " : "") +
                "style='position:absolute;top:0;left:0;width:100%;height:100%;" +
                "border:none;border-radius:15px;background:#f3f3f3;'>" +
                "<source src='" + videoUrl + "' type='video/mp4'>" +
                "Your browser does not support the video tag." +
                "</video>";

            // Responsive wrapper (16:9 ratio)
            var sWrapper =
                "<div style='position:relative;width:100%;padding-top:56.25%;" +
                "overflow:hidden;border-radius:15px;background:#f3f3f3;'>" +
                sVideoTag +
                "</div>";

            oHtml.setContent(sWrapper);

            // Adjust fit after metadata is loaded
            setTimeout(function() {
                var videoEl = document.getElementById(htmlId + "_video");
                if (videoEl) {
                    videoEl.addEventListener("loadedmetadata", function() {
                        if (sap.ui.Device.system.desktop) {
                            videoEl.style.objectFit = "contain"; // show entire video on laptop/desktop
                        } else {
                            videoEl.style.objectFit = "cover"; // fill box on mobile/tablet
                        }
                    });
                }
            }, 200);
        },
    });
});