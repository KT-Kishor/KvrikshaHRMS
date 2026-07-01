sap.ui.define([

    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "../utils/validation",
],
    function (BaseController, JSONModel, MessageBox, MessageToast, utils) {
        "use strict";
        return BaseController.extend("sap.kt.com.minihrsolution.controller.CandidateQuestionDetailPage", {

            onInit: function () {
                this.getRouter().getRoute("RouteQuestionDetail").attachPatternMatched(this.QD_onRouteMatched, this);
            },
            QD_onRouteMatched: async function (oEvent) {

                var LoginFunction = await this.commonLoginFunction("SelfService");
                if (!LoginFunction) return;
                // this.getBusyDialog();
                const oView = this.getView();
                const oLoginModel = oView.getModel("LoginModel");
                const oLoginData = oLoginModel.getData();
                this.oLoginModel = oLoginData;
                this.i18nModel = this.getOwnerComponent().getModel("i18n").getResourceBundle();
                oLoginModel.setProperty("/HeaderName", this.i18nModel.getText("candidatequestion"));
                this.getView().setModel(
                    new JSONModel({
                        question_text: "",
                        test_id: "",
                        type: "",
                        marks: "",
                        order_no: "",
                        difficulty: "",
                        selectedLanguages: [],
                        selectedSkillLevels: [],
                        options: []
                    }),
                    "detail"
                );

                var oDetailModel = this.getOwnerComponent().getModel("detail");
                var oData = oDetailModel.getData();

                var aLanguages = [];
                var aSkillLevels = [];
                if (oData.allowed_languages) {
                    aLanguages = oData.allowed_languages.split(",");
                }
                oData.selectedLanguages = aLanguages;

                if (oData.skill_levels) {
                    aSkillLevels = oData.skill_levels.split(",");
                }
                oData.selectedSkillLevels = aSkillLevels;
                if (oData.difficulty) {
                    oData.difficulty =
                        oData.difficulty.charAt(0).toUpperCase() +
                        oData.difficulty.slice(1).toLowerCase();
                }

                if (oData.options) {

                    oData.options.forEach(function (oOption) {

                        if (oOption.note) {

                            try {

                                var oNote = JSON.parse(oOption.note);

                                oOption.input = oNote.input || "";
                                oOption.output = oNote.output || "";
                                oOption.description = oNote.description || "";

                            } catch (e) {

                                oOption.input = "";
                                oOption.output = "";
                                oOption.description = "";
                            }
                        }
                    });
                }

                oDetailModel.refresh(true);

                this.getView().setModel(oDetailModel, "detail");
                var oUIModel = this.getOwnerComponent().getModel("ui");

                if (oUIModel) {
                    this.getView().setModel(oUIModel, "ui");
                }

            },
            onAddOption: function () {

                var oModel = this.getView().getModel("detail");
                var aOptions = oModel.getProperty("/options") || [];
                var sType = oModel.getProperty("/type");

                if (sType === "coding") {

                    aOptions.push({
                        option_text: "",
                        input: "",
                        output: "",
                        description: "",
                        note: "",
                        order_no: aOptions.length + 1,
                        is_correct: false
                    });

                } else {

                    aOptions.push({
                        option_text: "",
                        is_correct: false,
                        order_no: aOptions.length + 1
                    });
                }

                oModel.setProperty("/options", aOptions);
                oModel.refresh(true);
            },
            onDeleteOption: function (oEvent) {
                var oModel = this.getView().getModel("detail");
                var aOptions = oModel.getProperty("/options") || [];
                var oItem = oEvent.getSource().getParent(); // ColumnListItem
                var oContext = oItem.getBindingContext("detail");

                var iIndex = parseInt(oContext.getPath().split("/").pop(), 10);
                aOptions.splice(iIndex, 1);
                // Re-sequence order numbers
                aOptions.forEach(function (oOption, iIndex) {
                    oOption.order_no = iIndex + 1;
                });
                oModel.setProperty("/options", aOptions);
                oModel.refresh(true);
            },
            onNavBack: function () {

                var oDetailModel = new JSONModel({
                    question_text: "",
                    test_id: "",
                    type: "",
                    marks: "",
                    order_no: "",
                    difficulty: "",
                    topic: "",
                    allowed_languages: "",
                    skill_levels: "",
                    selectedLanguages: [],
                    selectedSkillLevels: [],
                    options: []
                });

                this.getOwnerComponent().setModel(oDetailModel, "detail");


                this.byId("idQuestion").setValueState("None");
                this.byId("idconstraints").setValueState("None");
                this.byId("idtestid").setValueState("None");
                this.byId("iddetailtype").setValueState("None");
                this.byId("idmark").setValueState("None");
                this.byId("idAllowedlanguages").setValueState("None");
                this.byId("idskilllevel").setValueState("None");

                this.getRouter().navTo("RouteManageCandidateQuestion");
            },
            onEditSavePress: async function () {

                var oModel = this.getView().getModel("detail");
                var oData = oModel.getData();
                var oUIModel = this.getView().getModel("ui");
                var bEditMode = oUIModel.getProperty("/editMode");

                if (
                    !utils._LCvalidateMandatoryField(this.byId("idQuestion"), "ID") ||
                    !utils._LCvalidateMandatoryField(this.byId("idtestid"), "ID") ||
                    !utils._LCstrictValidationComboBox(this.byId("iddetailtype"), "ID") ||
                    !utils._LCvalidateMandatoryField(this.byId("idmark"), "ID")
                ) {
                    MessageToast.show(this.i18nModel.getText("mandetoryFields"));
                    return;
                }

                // Coding specific validations
                if (oData.type === "coding") {

                    if (
                        !utils._LCvalidateMandatoryField(this.byId("idconstraints"), "ID") ||
                        !utils._LCvalidationMultiComboBox(this.byId("idAllowedlanguages"), "ID") ||
                        !utils._LCvalidationMultiComboBox(this.byId("idskilllevel"), "ID")
                    ) {
                        MessageToast.show(this.i18nModel.getText("mandetoryFields"));
                        return;
                    }
                }

                if (!oData.options || oData.options.length < 2) {
                    MessageToast.show("Minimum 2 options are required");
                    return;
                }

                if (!bEditMode) {

                    oUIModel.setProperty("/editMode", true);
                    return;

                }

                try {

                    this.getBusyDialog();

                    var oData = this.getView()
                        .getModel("detail")
                        .getData();

                    var payload = {

                        filters: {
                            id: oData.id
                        },

                        data: {

                            test_id: parseInt(
                                oData.test_id,
                                10
                            ),

                            question_text:
                                oData.question_text,

                            marks: parseInt(
                                oData.marks,
                                10
                            ),

                            order_no: parseInt(
                                oData.order_no,
                                10
                            ),

                            type:
                                oData.type,

                            title:
                                oData.title || "",

                            difficulty:
                                oData.difficulty || "",

                            topic:
                                oData.topic || "",

                            skill_levels:
                                oData.skill_levels || [],

                            constraints:
                                oData.constraints || [],

                            starter_code:
                                oData.starter_code || {},

                            allowed_languages:
                                oData.allowed_languages || [],

                            options: (oData.options || []).map(function (oOption, index) {

                                return {

                                    option_text:
                                        oOption.option_text || "",

                                    is_correct:
                                        oOption.is_correct === true ||
                                            oOption.is_correct === 1
                                            ? 1
                                            : 0,

                                    order_no:
                                        parseInt(
                                            oOption.order_no,
                                            10
                                        ) || (index + 1)

                                };

                                // Coding Question
                                if (oData.type === "coding") {

                                    oResult.note = {

                                        input:
                                            oOption.input || "",

                                        output:
                                            oOption.output || "",

                                        description:
                                            oOption.description || ""

                                    };

                                }

                                return oResult;

                            })

                        }

                    };

                    console.log(payload);

                    await this.ajaxUpdateWithJQuery(
                        "QuestionWithOptions",
                        payload
                    );

                    MessageToast.show(
                        "Question updated successfully"
                    );

                    oUIModel.setProperty(
                        "/editMode",
                        false
                    );

                } catch (oError) {

                    MessageBox.error(
                        oError.message ||
                        "Failed to update question"
                    );

                } finally {

                    this.closeBusyDialog();

                }

            },
            onQuestionchange: function (oEvent) {
                utils._LCvalidateMandatoryField(oEvent)
            },
            onconstraintslivechnage: function (oEvent) {
                utils._LCvalidateMandatoryField(oEvent)
            },
            ontestidlivechnage: function (oEvent) {
                utils._LCvalidateMandatoryField(oEvent)
            },
            ontypechange: function (oEvent) {
                utils._LCstrictValidationComboBox(oEvent)
            },
            onmarklivechnage: function (oEvent) {
                utils._LCvalidateMandatoryField(oEvent)
            },
            MI_onSelectionChangeType: function (oEvent) {
                utils._LCvalidationMultiComboBox(oEvent)
            },
            MI_onSelectskill: function (oEvent) {
                utils._LCvalidationMultiComboBox(oEvent)
            },
            onCorrectAnswerSelect: function (oEvent) {

                var oModel = this.getView().getModel("detail");
                var aOptions = oModel.getProperty("/options");

                var iIndex = parseInt(
                    oEvent.getSource()
                        .getBindingContext("detail")
                        .getPath()
                        .split("/")
                        .pop(),
                    10
                );

                aOptions.forEach(function (oOption, index) {
                    oOption.is_correct = (index === iIndex ? 1 : 0);
                });

                oModel.refresh(true);
            },
            onCreateQuestion: async function () {

                try {

                    var oModel = this.getView().getModel("detail");
                    var oData = oModel.getData();

                    // Mandatory validations
                    if (
                        !utils._LCvalidateMandatoryField(this.byId("idQuestion"), "ID") ||
                        !utils._LCvalidateMandatoryField(this.byId("idtestid"), "ID") ||
                        !utils._LCstrictValidationComboBox(this.byId("iddetailtype"), "ID") ||
                        !utils._LCvalidateMandatoryField(this.byId("idmark"), "ID")
                    ) {
                        MessageToast.show(this.i18nModel.getText("mandetoryFields"));
                        return;
                    }

                    // Coding specific validations
                    if (oData.type === "coding") {

                        if (
                            !utils._LCvalidateMandatoryField(this.byId("idconstraints"), "ID") ||
                            !utils._LCvalidationMultiComboBox(this.byId("idAllowedlanguages"), "ID") ||
                            !utils._LCvalidationMultiComboBox(this.byId("idskilllevel"), "ID")
                        ) {
                            MessageToast.show(this.i18nModel.getText("mandetoryFields"));
                            return;
                        }
                    }

                    if (!oData.options || oData.options.length < 2) {
                        MessageToast.show("Minimum 2 options are required");
                        return;
                    }

                    var payload = {};

                    // =========================
                    // CODING QUESTION
                    // =========================

                    if (oData.type === "coding") {

                        payload = {

                            test_id: parseInt(oData.test_id, 10),

                            type: "coding",

                            title: oData.question_text || "",

                            question_text: oData.question_text || "",

                            marks: parseInt(oData.marks, 10),

                            order_no: parseInt(oData.order_no || 1, 10),

                            difficulty: oData.difficulty || "",

                            topic: oData.topic || "",

                            skill_levels: oData.selectedSkillLevels || [],

                            constraints: typeof oData.constraints === "string"
                                ? oData.constraints
                                    .split("|")
                                    .map(function (s) {
                                        return s.trim();
                                    })
                                    .filter(Boolean)
                                : (oData.constraints || []),

                            starter_code: {

                                JavaScript: oData.starterCodeJS || "",

                                Java: oData.starterCodeJava || "",
                                Python: oData.starterCodePython || ""

                            },

                            allowed_languages:
                                oData.selectedLanguages || [],
                            options: (oData.options || [])
                                .map(function (oOption, iIndex) {

                                    return {
                                        option_text: oOption.option_text ||
                                            ("Example " + (iIndex + 1)),

                                        is_correct: false,
                                        order_no: iIndex + 1,
                                        note: {
                                            input: oOption.input || "",
                                            output: oOption.output || "",
                                            description: oOption.description || ""

                                        }

                                    };

                                })
                                .filter(function (oOption) {

                                    return (
                                        oOption.note.input ||
                                        oOption.note.output ||
                                        oOption.note.description
                                    );

                                })

                        };

                    } else {

                        var bCorrectAnswerExists =
                            oData.options.some(function (oOption) {

                                return oOption.is_correct === 1 ||
                                    oOption.is_correct === true;

                            });

                        if (!bCorrectAnswerExists) {
                            MessageToast.show(
                                "Please select one correct answer."
                            );

                            return;
                        }

                        payload = {

                            test_id: parseInt(oData.test_id, 10),
                            question_text: oData.question_text,
                            marks: parseInt(oData.marks, 10),
                            order_no: parseInt(
                                oData.order_no || 1,
                                10
                            ),

                            type: oData.type,

                            options: oData.options.map(
                                function (oOption, iIndex) {

                                    return {
                                        option_text:
                                            oOption.option_text,
                                        is_correct:
                                            (oOption.is_correct === 1 ||
                                                oOption.is_correct === true) ? 1 : 0,

                                    };

                                })

                        };
                    }

                    this.getBusyDialog();

                    await this.ajaxCreateWithJQuery(
                        "QuestionWithOptions",
                        {
                            data: payload
                        }
                    );

                    this.closeBusyDialog();

                    MessageToast.show(
                        "Question created successfully"
                    );

                    this.getRouter().navTo(
                        "RouteManageCandidateQuestion"
                    );

                } catch (oError) {

                    this.closeBusyDialog();

                    MessageBox.error(
                        oError.message ||
                        "Failed to create question"
                    );
                }
            }
        })
    }
)