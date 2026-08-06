sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (BaseController, JSONModel, MessageToast, MessageBox) {
    "use strict";

    return BaseController.extend("sap.kt.com.minihrsolution.controller.PDFCondition", {

        onInit: function () {
            this.getRouter().getRoute("RoutePDFCondition").attachMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: async function (oEvent) {
            var LoginFUnction = await this.commonLoginFunction("MSA&SOW");
            if (!LoginFUnction) return;

            var oViewModel = new JSONModel({
                busy: true,
                conditions: []
            });
            this.getView().setModel(oViewModel, "view");

            this._loadPDFConditionData();
        },

        // -----------------------------------------------------------------
        // Data loading
        // -----------------------------------------------------------------

        _loadPDFConditionData: async function () {
            this.getView().getModel("view").setProperty("/busy", true);

            var vResult = await this.ajaxReadWithJQuery("PDFCondition", { Type: "SOW" });

            var oModel = new JSONModel(vResult?.data);
            this.getView().setModel(oModel, "PDFConditionModel");

            this._waitForData(vResult)
                .then(this._onPDFConditionDataLoaded.bind(this))
                .catch(function (oError) {
                    this.getView().getModel("view").setProperty("/busy", false);
                    MessageBox.error(
                        this._text("loadErrorMessage", "Could not load PDF Condition data."),
                        { details: oError && oError.message }
                    );
                }.bind(this));
        },

        _waitForData: function (vResult) {
            var that = this;

            if (vResult && typeof vResult.then === "function") {
                return vResult;
            }

            return new Promise(function (resolve, reject) {
                var oModel = that.getView().getModel("PDFConditionModel");

                if (oModel && oModel.getData && Object.keys(oModel.getData()).length) {
                    resolve();
                    return;
                }

                if (oModel && oModel.attachEventOnce) {
                    oModel.attachEventOnce("requestCompleted", function () {
                        resolve();
                    });
                    oModel.attachEventOnce("requestFailed", function (oEvent) {
                        reject(oEvent.getParameter("errorObject") || new Error("Request failed"));
                    });
                } else {
                    // Data was already set synchronously via ajaxReadWithJQuery
                    resolve();
                }
            });
        },

        /**
         * Transforms the flat list of PDFCondition rows (one row per point,
         * rows sharing the same Title/TitleContent belong to the same
         * condition group) into an array of grouped conditions.
         */
        _onPDFConditionDataLoaded: function () {
            var oModel = this.getView().getModel("PDFConditionModel");
            var oViewModel = this.getView().getModel("view");
            var oRaw = oModel ? oModel.getData() : {};

            var aRecords = Array.isArray(oRaw) ? oRaw : (oRaw && (oRaw.results || oRaw.value)) || [];

            if (!aRecords.length) {
                oViewModel.setProperty("/busy", false);
                oViewModel.setProperty("/conditions", []);
                MessageToast.show(this._text("noDataFound", "No records found for Type = SOW."));
                return;
            }

            // Group flat rows into one entry per distinct Title/TitleContent.
            // NOTE: grouping by Title text is a fallback - if PDFCondition has
            // (or can get) a dedicated header/group id field, group by that
            // instead, in case two different conditions can share the same
            // Title wording.
            var oGroups = {};
            var aOrder = [];

            aRecords.forEach(function (oRecord) {
                var sKey = oRecord.Title;
                if (!oGroups[sKey]) {
                    oGroups[sKey] = {
                        Type: oRecord.Type,
                        Title: oRecord.Title,
                        TitleContent: oRecord.TitleContent,
                        Points: []
                    };
                    aOrder.push(sKey);
                }
                oGroups[sKey].Points.push({
                    ID: oRecord.ID,
                    PointNo: oRecord.PointNo,
                    PointTitle: oRecord.PointTitle,
                    PointDesc: oRecord.PointDesc
                });
            });

            var aConditions = aOrder.map(function (sKey) { return oGroups[sKey]; });

            oViewModel.setProperty("/conditions", aConditions);
            oViewModel.setProperty("/busy", false);
        },

        // -----------------------------------------------------------------
        // Save -> PDFConditionHistory (never updates PDFCondition)
        // -----------------------------------------------------------------

        onSave: function () {
            var oViewModel = this.getView().getModel("view");
            var aConditions = oViewModel.getProperty("/conditions") || [];
            var sUser = this._getCurrentUserId();
            var oNow = new Date();

            var aPayloads = [];
            aConditions.forEach(function (oCondition) {
                (oCondition.Points || []).forEach(function (oPoint) {
                    aPayloads.push({
                        ID: this._generateUUID(),
                        OriginalID: oPoint.ID,
                        Type: oCondition.Type,
                        Title: oCondition.Title,
                        TitleContent: oCondition.TitleContent,
                        PointNo: oPoint.PointNo,
                        PointTitle: oPoint.PointTitle,
                        PointDesc: oPoint.PointDesc,
                        CreatedBy: sUser,
                        CreatedAt: oNow.toISOString()
                    });
                }, this);
            }, this);

            if (!aPayloads.length) {
                MessageToast.show(this._text("nothingToSave", "There is nothing to save."));
                return;
            }

            oViewModel.setProperty("/busy", true);

            var oODataModel = this.getView().getModel(); // default OData V4 model
            var oListBinding = oODataModel.bindList("/PDFConditionHistory");

            var aCreatePromises = aPayloads.map(function (oPayload) {
                return oListBinding.create(oPayload).created();
            });

            oODataModel.submitBatch("$auto")
                .then(function () {
                    return Promise.all(aCreatePromises);
                })
                .then(function () {
                    oViewModel.setProperty("/busy", false);
                    MessageToast.show(this._text("saveSuccess", "Changes saved to history successfully."));
                }.bind(this))
                .catch(function (oError) {
                    oViewModel.setProperty("/busy", false);
                    MessageBox.error(
                        this._text("saveError", "An error occurred while saving to history."),
                        { details: oError && oError.message }
                    );
                }.bind(this));
        },

        _getCurrentUserId: function () {
            try {
                if (sap.ushell && sap.ushell.Container && sap.ushell.Container.getUser) {
                    return sap.ushell.Container.getUser().getId() || "SYSTEM";
                }
            } catch (e) {
                // ignore - Fiori Launchpad Container not available (e.g. local testing)
            }
            return "SYSTEM";
        },

        _generateUUID: function () {
            if (window.crypto && window.crypto.randomUUID) {
                return window.crypto.randomUUID();
            }
            return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0;
                var v = c === "x" ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        },

        // -----------------------------------------------------------------
        // Generate PDF (client-side, uses the data currently on screen)
        // -----------------------------------------------------------------

        onGeneratePDF: function () {
            var aConditions = this.getView().getModel("view").getProperty("/conditions") || [];

            if (typeof pdfMake === "undefined") {
                MessageBox.error(this._text("pdfLibMissing", "PDF library (pdfmake) is not loaded. Check index.html script includes."));
                return;
            }
            if (!aConditions.length) {
                MessageToast.show(this._text("nothingToSave", "There is nothing to generate."));
                return;
            }

            var aContent = [];
            aConditions.forEach(function (oCondition, iCondIndex) {
                if (iCondIndex > 0) {
                    aContent.push({ text: "", pageBreak: "before" });
                }
                aContent.push({ text: oCondition.Title || "", style: "header" });
                aContent.push({ text: oCondition.TitleContent || "", style: "subheader", margin: [0, 4, 0, 12] });
                aContent.push({ text: "Points", style: "sectionHeader", margin: [0, 0, 0, 4] });

                (oCondition.Points || []).forEach(function (oPoint, iIndex) {
                    aContent.push({
                        text: (oPoint.PointNo || (iIndex + 1)) + ". " + (oPoint.PointTitle || ""),
                        style: "pointTitle",
                        margin: [0, 10, 0, 2]
                    });
                    aContent.push({
                        text: oPoint.PointDesc || "",
                        style: "pointDesc",
                        margin: [0, 0, 0, 4]
                    });
                });
            });

            var oDocDefinition = {
                content: aContent,
                styles: {
                    header: { fontSize: 18, bold: true },
                    subheader: { fontSize: 11 },
                    sectionHeader: { fontSize: 13, bold: true, decoration: "underline" },
                    pointTitle: { fontSize: 12, bold: true },
                    pointDesc: { fontSize: 10 }
                },
                defaultStyle: { fontSize: 10 }
            };

            var sFileName = aConditions.length === 1
                ? ((aConditions[0].Title || "PDFCondition").replace(/[^a-z0-9]+/gi, "_")) + ".pdf"
                : "PDFConditions.pdf";

            try {
                pdfMake.createPdf(oDocDefinition).download(sFileName);
                MessageToast.show(this._text("pdfGenerated", "PDF generated successfully."));
            } catch (oError) {
                MessageBox.error(
                    this._text("pdfError", "An error occurred while generating the PDF."),
                    { details: oError && oError.message }
                );
            }
        },

        // -----------------------------------------------------------------
        // Helpers
        // -----------------------------------------------------------------

        _text: function (sKey, sFallback) {
            try {
                return this.getView().getModel("i18n").getResourceBundle().getText(sKey);
            } catch (e) {
                return sFallback;
            }
        }
    });
});