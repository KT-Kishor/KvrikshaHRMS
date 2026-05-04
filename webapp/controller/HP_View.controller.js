sap.ui.define(
    [
        "./BaseController",
        "sap/ui/model/json/JSONModel",
        "sap/m/MessageToast",
        "sap/ui/core/Fragment",
        "../model/formatter",
        "../utils/validation",
        "sap/ui/richtexteditor/RichTextEditor",
        'sap/ui/export/Spreadsheet',
    ],
    (BaseController, JSONModel, MessageToast, Fragment, formatter, validation, RichTextEditor, Spreadsheet) => {
        "use strict";
        return BaseController.extend(
            "sap.kt.com.minihrsolution.controller.HP_View", {
            formatter: formatter,
            onInit: function () {
                const router = this.getOwnerComponent().getRouter();
                router.getRoute("RouteHP_View").attachPatternMatched(this._onObjectMatched, this);
            },

            _onObjectMatched: async function () {
                this.i18nModel = this.getOwnerComponent().getModel("i18n").getResourceBundle()
                this.CompanyCodeDetailsModel = this.getView().getModel("CompanyCodeDetailsModel")?.getData() || [];
                try {
                    var LoginFUnction = await this.commonLoginFunction("JobPosting");
                    if (!LoginFUnction) {
                        return;
                    }
                    //  i18n + validation init
                    this.i18na = this.getView().getModel("i18n")?.getResourceBundle();
                    this.validation = validation;

                    //  Set Header Name using i18n
                    const sHeaderText = this.i18na.getText("JobPosting");
                    this.getView().getModel("LoginModel").setProperty("/HeaderName", sHeaderText);

                    // Reset controller state
                    this._productDialog = null;
                    this._isEdit = false;
                    this._editIndex = null;

                    // Load backend data
                    await this._fetchJobOpenings();
                    await this._setBackendStatusModel();
                    await this._getUniqueSkillsFromCandidates();
                    await this._setFilterJobModel();
                } catch (error) {
                    // Proper error capture
                    MessageToast.show(
                        error?.message || error?.responseText || "Unknown error occurred."
                    );
                } finally {
                    this.closeBusyDialog();
                }
            },

            onPressback: function () {
                this.getRouter().navTo("RouteTilePage");
            },

            onLogout: function () {
                this.CommonLogoutFunction();
            },

            HP_onChangeBranchCode: function (oEvent) {
                validation._LCstrictValidationComboBox(oEvent, "oEvent");
                var oSelectedItem = oEvent.getParameter("selectedItem");
                var oTempModel = this.getView().getModel("temporaryModel");

                if (!oSelectedItem) {
                    oTempModel.setProperty("/branchCode", "");
                    oTempModel.setProperty("/country", "");
                    oTempModel.setProperty("/state", "");
                    oTempModel.setProperty("/Location", "");
                    return;
                }

                var oSelectedObject = oSelectedItem.getBindingContext("CompanyCodeDetailsModel").getObject();

                oTempModel.setProperty("/branchCode", oSelectedObject.branchCode || "");
                oTempModel.setProperty("/country", oSelectedObject.country || oSelectedObject.countryName || "");
                oTempModel.setProperty("/state", oSelectedObject.state || oSelectedObject.stateName || "");
                oTempModel.setProperty("/Location", oSelectedObject.city || oSelectedObject.cityName || "");
            },

            _updateDynamicFilters: function (aData) {
                const aSkills = aData
                    .map((i) => i.PrimarySkills)
                    .filter(Boolean)
                    .flatMap((s) => s.split(",").map((skill) => skill.trim()))
                    .filter(Boolean);

                const aUniqueSkills = [...new Set(aSkills)].map((skill) => ({
                    skill,
                }));

                this.getView().setModel(
                    new JSONModel({
                        skills: aUniqueSkills
                    }),
                    "skillModel"
                );
            },

            _fetchJobOpenings: async function () {
                try {
                    this.getBusyDialog();

                    const oResponse = await this.ajaxReadWithJQuery("JobOpenings");
                    const aData = oResponse?.data || [];

                    const oModel = new JSONModel({
                        Candidates: aData
                    });
                    this.getView().setModel(oModel, "JobApplicationModel");
                    this._getUniqueSkillsFromCandidates();
                    this._setFilterJobModel();
                } catch (err) {
                    this.closeBusyDialog();
                    MessageToast.show(this.getText?.("dataLoadError"));
                } finally {
                    this.closeBusyDialog();
                }
            },

            _setStatusModel: function () {
                const oStatusModel = new JSONModel({
                    statusOptions: [{
                        key: "true",
                        text: "Active"
                    },
                    {
                        key: "false",
                        text: "Inactive"
                    },
                    ],
                });
                this.getView().setModel(oStatusModel, "BackendStatusModel");
            },

            _getUniqueSkillsFromCandidates: function () {
                const oModel = this.getView().getModel("JobApplicationModel");
                const aCandidates = oModel?.getProperty("/Candidates") || [];

                const aSkills = aCandidates
                    .map((c) => c.PrimarySkills?.split(",") || [])
                    .flat()
                    .map((skill) => skill.trim())
                    .filter(Boolean);

                const aUniqueSkills = [...new Set(aSkills)].map((skill) => ({
                    skill,
                }));

                const oSkillModel = new JSONModel({
                    skills: aUniqueSkills
                });
                this.getView().setModel(oSkillModel, "skillModel");
            },

            _setBackendStatusModel: function () {
                const oStatusModel = new JSONModel([{
                    key: "true",
                    text: "Active"
                },
                {
                    key: "false",
                    text: "Inactive"
                },
                ]);
                this.getView().setModel(oStatusModel, "BackendStatusModel");
            },

            _setFilterJobModel: function () {
                const aCandidates = this.getView().getModel("JobApplicationModel")?.getProperty("/Candidates") || [];

                const aUniqueLocations = [...new Map(
                    aCandidates
                        .filter(item => item.Location)
                        .map(item => [item.Location.trim(), item])
                ).values()];

                const oFilterModel = new JSONModel({
                    LocationSet: aUniqueLocations
                });
                this.getView().setModel(oFilterModel, "FilterJobModel");
            },

            _extractFilterOptions: function () {
                const aCandidates =
                    this.getView()
                        .getModel("JobApplicationModel")
                        ?.getProperty("/Candidates") || [];

                // Location
                const aLocations = [
                    ...new Set(
                        aCandidates.map((o) => o.Location?.trim()).filter(Boolean)
                    ),
                ].map((loc) => ({
                    key: loc,
                    text: loc
                }));

                const oLocModel = new JSONModel({
                    cities: aLocations,
                });
                this.getView().setModel(oLocModel, "CityModel");

                // Experience
                const aExperience = [
                    ...new Set(
                        aCandidates.map((o) => o.Experience?.trim()).filter(Boolean)
                    ),
                ].map((exp) => ({
                    key: exp,
                    text: exp
                }));

                const oExpModel = new JSONModel(aExperience);
                this.getView().setModel(oExpModel, "BackendExperienceModel");

                //  Status
                const aStatus = [...new Set(aCandidates.map((o) => o.Status))].map(
                    (stat) => ({
                        key: stat?.toString(),
                        text: stat ? "Active" : "Inactive",
                    })
                );

                const oStatusModel = new JSONModel(aStatus);
                this.getView().setModel(oStatusModel, "BackendStatusModel");

                //  Primary Skills
                const aSkills = aCandidates
                    .map((o) => o.PrimarySkills)
                    .filter(Boolean)
                    .flatMap((s) => s.split(","))
                    .map((s) => s.trim())
                    .filter(Boolean);

                const aUniqueSkills = [...new Set(aSkills)].map((skill) => ({
                    skill,
                }));
                const oSkillModel = new JSONModel({
                    skills: aUniqueSkills,
                });
                this.getView().setModel(oSkillModel, "skillModel");
            },

            _commonFragmentOpen: async function (
                oTempModel,
                fragmentPath,
                dialogId,
                datePickerIds = []
            ) {
                const oView = this.getView();

                if (!this._dialogMap) {
                    this._dialogMap = {};
                }

                let oDialog = this._dialogMap[dialogId];

                if (!oDialog) {
                    oDialog = await Fragment.load({
                        id: oView.getId(),
                        name: fragmentPath,
                        controller: this,
                    });

                    oView.addDependent(oDialog);
                    this._dialogMap[dialogId] = oDialog;
                }

                //  Bind model before opening
                oDialog.setModel(oTempModel, "temporaryModel");
                oView.setModel(oTempModel, "temporaryModel");

                if (!oTempModel.getProperty("/jobTypeIndex") && oTempModel.getProperty("/jobTypeIndex") !== 0) {
                    oTempModel.setProperty("/jobTypeIndex", 0); // 0 = Our Company, 1 = Client Recruitment
                }
                // Set min/max range for DatePickers
                datePickerIds.forEach((id) => {
                    const oDP = this.byId(id);
                    if (oDP?.setMinDate && oDP?.setMaxDate) {
                        const oToday = new Date();
                        const oMinDate = new Date();
                        oMinDate.setFullYear(oToday.getFullYear() - 20);
                        oDP.setMinDate(oMinDate);
                        oDP.setMaxDate(oToday);
                    }
                });

                // Set DatePickers readonly
                datePickerIds.forEach((id) => {
                    const oDP = this.byId(id);
                    if (oDP) {
                        const $input = oDP.$().find("input");
                        if ($input?.length > 0) {
                            $input.attr("readonly", true);
                        }
                    }
                });

                oDialog.open();
            },

            onJobTypeSelect: function (oEvent) {
                var iSelectedIndex = oEvent.getParameter("selectedIndex");
                var oTempModel = this.getView().getModel("temporaryModel");

                oTempModel.setProperty("/jobTypeIndex", iSelectedIndex);

                if (iSelectedIndex === 0) {
                    oTempModel.setProperty("/clientName", "");
                    oTempModel.setProperty("/branchCode", "");
                    oTempModel.setProperty("/country", "");
                    oTempModel.setProperty("/state", "");
                    oTempModel.setProperty("/Location", "");
                } else if (iSelectedIndex === 1) {
                    oTempModel.setProperty("/branchCode", "");
                    oTempModel.setProperty("/country", "");
                    oTempModel.setProperty("/state", "");
                    oTempModel.setProperty("/Location", "");
                }
            },

            _openJobDialog: function (oTempModel) {
                return this._commonFragmentOpen(
                    oTempModel,
                    "sap.kt.com.minihrsolution.fragment.AddEditJob",
                    "addJobDialog",
                    ["postDateDP"]
                ).then(() => {
                    const oMultiInput = this.byId("multiInputQualifications");
                    if (oMultiInput) {
                        oMultiInput.removeAllTokens();
                        const aQualifications =
                            oTempModel.getProperty("/qualifications") || [];
                        aQualifications.forEach((q) => {
                            oMultiInput.addToken(new sap.m.Token({
                                text: q,
                                key: q
                            }));
                        });
                    }

                    this._initRichTextEditors();
                    this._initializeDefaultDropdownValues();
                });
            },

            HP_onChangeCountry: function (oEvent) {
                validation._LCstrictValidationComboBox(oEvent, "oEvent");
                const oSelectedItem = oEvent.getSource().getSelectedItem();
                const oStateCombo = this.byId("HP_id_State");
                const oCityCombo = this.byId("HP_id_City");
                const oModel = this.getView().getModel("temporaryModel");

                // Reset dependent fields
                oStateCombo.setSelectedKey("");
                oStateCombo.getBinding("items")?.filter([]);
                oCityCombo.setSelectedKey("");
                oCityCombo.getBinding("items")?.filter([]);

                if (!oSelectedItem) {
                    // reset model
                    oModel.setProperty("/country", "");
                    oModel.setProperty("/state", "");
                    oModel.setProperty("/Location", "");
                } else {
                    // fetch country data
                    const sCountryCode = oSelectedItem.getAdditionalText(); // "IN"
                    const sCountryName = oSelectedItem.getText();

                    // filter states by countryCode
                    oStateCombo.getBinding("items")?.filter([
                        new sap.ui.model.Filter("countryCode", sap.ui.model.FilterOperator.EQ, sCountryCode)
                    ]);

                    // set model props
                    oModel.setProperty("/country", sCountryName || "");
                }
            },

            HP_onChangeState: function (oEvent) {
                validation._LCstrictValidationComboBox(oEvent, "oEvent");
                const oSelectedItem = oEvent.getSource().getSelectedItem();

                const oCityCombo = this.byId("HP_id_City");
                const oCountryCB = this.byId("HP_id_Country");
                const oModel = this.getView().getModel("temporaryModel");

                // Clear cities
                oCityCombo.setSelectedKey("");
                oCityCombo.getBinding("items")?.filter([]);

                if (!oSelectedItem) {
                    oModel.setProperty("/state", "");
                    oModel.setProperty("/Location", "");
                } else {
                    const sStateName = oSelectedItem.getKey() || oSelectedItem.getText();
                    const sCountryCode = oCountryCB.getSelectedItem()?.getAdditionalText();

                    // filter cities based on state + country
                    oCityCombo.getBinding("items")?.filter([
                        new sap.ui.model.Filter("stateName", sap.ui.model.FilterOperator.EQ, sStateName),
                        new sap.ui.model.Filter("countryCode", sap.ui.model.FilterOperator.EQ, sCountryCode)
                    ]);

                    oModel.setProperty("/state", sStateName || "");
                }
            },

            HP_onChangeCity: function (oEvent) {
                validation._LCstrictValidationComboBox(oEvent);

                const oSelectedItem = oEvent.getSource().getSelectedItem();
                const oModel = this.getView().getModel("temporaryModel");

                if (!oSelectedItem) {
                    oModel.setProperty("/Location", "");
                } else {
                    const sCityName = oSelectedItem.getKey() || oSelectedItem.getText();
                    oModel.setProperty("/Location", sCityName || "");
                }
            },

            _initRichTextEditors: function () {
                const oView = this.getView();
                const oModel = oView.getModel("temporaryModel");

                if (!oModel) {
                    return;
                }

                const aRTEs = [{
                    vboxId: "jobDescRTE",
                    prop: "JobDescription",
                    mandatory: true
                },
                {
                    vboxId: "keyRespRTE",
                    prop: "KeyResponsibilities",
                    mandatory: false,
                },
                {
                    vboxId: "secondarySkillsRTE",
                    prop: "SecondarySkills",
                    mandatory: true,
                },
                {
                    vboxId: "skillReqRTE",
                    prop: "SkillRequirements",
                    mandatory: false,
                },
                ];

                setTimeout(() => {
                    aRTEs.forEach(({
                        vboxId,
                        prop,
                        mandatory
                    }) => {
                        const oVBox = oView.byId(vboxId);
                        if (!oVBox) {
                            return;
                        }

                        oVBox.addStyleClass("myRTEBorderVBox");

                        oVBox.destroyItems();
                        const sValue = oModel.getProperty("/" + prop) || "";

                        const oRTE = new RichTextEditor({
                            width: "100%",
                            height: "250px",
                            editorType: sap.ui.richtexteditor.EditorType.TinyMCE,
                            showGroupFont: true,
                            showGroupTextAlign: true,
                            showGroupStructure: true,
                            customToolbar: true,
                            value: sValue,
                            ready: (oEvent) => {
                                const editor = oEvent.getSource();
                                if (editor.getValue() !== sValue) {
                                    editor.setValue(sValue);
                                }
                            },
                        });

                        oRTE.attachChange(() => {
                            const sVal = oRTE.getValue();
                            oModel.setProperty("/" + prop, sVal);

                            // 🔍 Validate on change
                            const sPlainText = sVal
                                .replace(/<[^>]*>/g, "")
                                .replace(/&nbsp;/g, "")
                                .trim();
                            const isEmpty = sPlainText === "";
                            const isShort = sPlainText.length < 8;

                            if (mandatory && (isEmpty || isShort)) {
                                oVBox.addStyleClass("sapUiRTEErrorBorder");
                            } else if (!mandatory && !isEmpty && isShort) {
                                oVBox.addStyleClass("sapUiRTEErrorBorder");
                            } else {
                                oVBox.removeStyleClass("sapUiRTEErrorBorder");
                            }
                        });

                        oVBox.addItem(oRTE);
                    });
                }, 100);
            },

            _validateRTEContent: function (oRTE, oVBox, rteId) {
                const sHTML = oRTE.getValue?.() || "";
                const sPlainText = sHTML
                    .replace(/<[^>]*>/g, "")
                    .replace(/&nbsp;/g, "")
                    .replace(/\s+/g, "")
                    .trim();

                const isEmpty = sPlainText === "";
                const isShort = sPlainText.length < 8;

                const mandatoryRTEs = ["jobDescEditor", "secondarySkillsEditor"];
                const optionalMin8RTEs = [
                    "skillRequirementsEditor",
                    "keyResponsibilitiesEditor",
                ];

                if (mandatoryRTEs.includes(rteId)) {
                    if (isEmpty || isShort) {
                        oVBox?.addStyleClass("sapUiRTEErrorBorder");
                    } else {
                        oVBox?.removeStyleClass("sapUiRTEErrorBorder");
                    }
                } else if (optionalMin8RTEs.includes(rteId)) {
                    if (!isEmpty && isShort) {
                        oVBox?.addStyleClass("sapUiRTEErrorBorder");
                    } else {
                        oVBox?.removeStyleClass("sapUiRTEErrorBorder");
                    }
                }
            },

            _initializeDefaultDropdownValues: function () {
                const oView = this.getView();
                const oModel = oView.getModel("temporaryModel");

                const oJobTitleCombo = oView.byId("JobTitleCombo");
                const oExperienceCombo = oView.byId("experienceCombo");
                const oStatusCombo = oView.byId("statusCombo");

                if (oJobTitleCombo?.getSelectedKey()) {
                    oModel.setProperty(
                        "/SelectedJobTitleKey",
                        oJobTitleCombo.getSelectedKey()
                    );
                }

                if (oExperienceCombo?.getSelectedKey()) {
                    oModel.setProperty(
                        "/SelectedExperienceKey",
                        oExperienceCombo.getSelectedKey()
                    );
                }

                if (this._isEdit && oStatusCombo?.getSelectedKey()) {
                    oModel.setProperty("/Status", oStatusCombo.getSelectedKey());
                }

                const oCertifications = oView.byId("certificationsInput");
                if (oCertifications?.getValue()) {
                    oModel.setProperty("/Certifications", oCertifications.getValue());
                }

                const oPrimarySkills = oView.byId("primarySkillsInput");
                if (oPrimarySkills?.getValue()) {
                    oModel.setProperty("/PrimarySkills", oPrimarySkills.getValue());
                }

                const oNoOfPositions = oView.byId("positionsInput");
                if (oNoOfPositions?.getValue()) {
                    oModel.setProperty("/NoOfPositions", oNoOfPositions.getValue());
                }
            },

            onOpenAddJobDialog: function () {
                const oView = this.getView();
                this._isEdit = false;
                this._editJobId = null;
                const oToday = new Date();
                const sFormattedDate = `${oToday.getFullYear()}-${String(oToday.getMonth() + 1).padStart(2, "0")}-${String(oToday.getDate()).padStart(2, "0")}`;

                this.getBusyDialog();

                const oTempModel = new JSONModel({
                    dialogTitle: "Create Job Posting",
                    SelectedJobTitleKey: "",
                    qualifications: [],
                    SelectedExperienceKey: "",
                    country: "",
                    state: "",
                    Location: "",
                    JobDescription: "",
                    KeyResponsibilities: "",
                    PrimarySkills: "",
                    SecondarySkills: "",
                    SkillRequirements: "",
                    Certifications: "",
                    SelectedWorkMode: "",
                    NoOfPositions: "",
                    PostDate: sFormattedDate,
                    Status: "true",
                    isEdit: false,
                    branchCode: "",
                    clientName: "",
                    jobTypeIndex: 0, // 0 = Our Company, 1 = Client Recruitment
                });

                oView.setModel(oTempModel, "temporaryModel");

                this._openJobDialog(oTempModel)
                    .catch((error) => {
                        MessageToast.show(error.message || error.responseText);
                    })
                    .finally(() => {
                        this.closeBusyDialog();
                    });
            },

            onOpenEditJobDialog: function () {
                const oView = this.getView();
                const oTable = this.byId("jobPostingTable");
                const oSelectedItem = oTable.getSelectedItem();

                if (!oSelectedItem) {
                    MessageToast.show("Please select a row to edit");
                    return;
                }

                this.getBusyDialog();

                const oContext = oSelectedItem.getBindingContext("JobApplicationModel");
                const oData = oContext.getObject();

                this._isEdit = true;
                this._editJobId = oData.ID || "";

                const aQualifications = (oData.Qualification || "")
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);

                const aLocations =
                    oView.getModel("CityModel")?.getProperty("/") || [];
                const selectedLocationId =
                    aLocations.find((loc) => loc.city === oData.Location)?.id || "";

                const workingModes =
                    oView.getModel("WorkingMode")?.getProperty("/location") || [];
                const selectedWorkModeId =
                    workingModes.find((mode) => mode.Location === oData.LocationService)
                        ?.ID || "";

                const oTempModel = new JSONModel({
                    dialogTitle: `Edit Post — ${oData.JobTitle || ""}`,
                    SelectedJobTitleValue: oData.JobTitle || "",
                    qualifications: aQualifications,
                  SelectedExperienceKey: String(oData.Experience) === "0" ? "Fresher" : String(oData.Experience || ""),
                    SelectedJobLocation: oData.Location || "",
                    JobDescription: oData.JobDescription || "",
                    KeyResponsibilities: oData.KeyResponsibilities || "",
                    PrimarySkills: oData.PrimarySkills || "",
                    SecondarySkills: oData.SecondarySkills || "",
                    SkillRequirements: oData.SkillRequirements || "",
                    Certifications: oData.Certifications || "",
                    SelectedWorkMode: selectedWorkModeId,
                    NoOfPositions: oData.NoOfPositions || "",
                    PostDate: (oData.PostDate || "").split("T")[0] || "",
                    Status: oData.Status || "false",
                    isEdit: true,
                    country: oData.country || "",
                    state: oData.state || "",
                    Location: oData.Location || "",
                    branchCode: oData.BranchCode || "",
                    clientName: oData.ClientName || "",
                    jobTypeIndex: oData.RecruitmentType === "Our Company" ? 0 : 1
                });

                oView.setModel(oTempModel, "temporaryModel");
                this._openJobDialog(oTempModel)
                    .then(() => {
                        this._applyCountryStateCityFilters(oData);
                    })
                    .catch(() => { })
                    .finally(() => {
                        this.closeBusyDialog();
                    });
            },


            _applyCountryStateCityFilters: function (oData) {
                if (!oData) return;
                const sCountry = oData.country || "";
                const sState = oData.state || "";
                const sCity = oData.Location || "";

                const oView = this.getView();
                const oCountryCB = sap.ui.core.Fragment.byId(oView.getId(), "HP_id_Country");
                const oStateCB = sap.ui.core.Fragment.byId(oView.getId(), "HP_id_State");
                const oCityCB = sap.ui.core.Fragment.byId(oView.getId(), "HP_id_City");

                // Reset filters
                oStateCB.getBinding("items")?.filter([]);
                oCityCB.getBinding("items")?.filter([]);

                if (sCountry) {
                    const aCountryData = oView.getModel("CountryModel").getData();
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
                            oCityCB.getBinding("items")?.filter(aFilters);
                        }
                    }
                }

                // Set combo box values
                oCountryCB.setValue(sCountry);
                oStateCB.setValue(sState);
                oCityCB.setValue(sCity);
            },


            onQualificationsTokenUpdate: function (oEvent) {
                const oInput = oEvent.getSource();
                const oModel = this.getView().getModel("temporaryModel");

                const aCurrent = oModel.getProperty("/qualifications") || [];
                const aRemoved = oEvent.getParameter("removedTokens") || [];
                const aAdded = oEvent.getParameter("addedTokens") || [];

                // Handle removals
                if (aRemoved.length > 0) {
                    const aRemovedTexts = aRemoved.map((oToken) => oToken.getText());
                    const aUpdated = aCurrent.filter((q) => !aRemovedTexts.includes(q));
                    oModel.setProperty("/qualifications", aUpdated);
                }

                // Handle additions
                if (aAdded.length > 0) {
                    const aAddedTexts = aAdded.map((oToken) => oToken.getText());
                    const aUpdated = aCurrent.concat(aAddedTexts);
                    oModel.setProperty("/qualifications", aUpdated);
                }

                // Always validate after change (whether added or removed)
                setTimeout(() => {
                    const aTokens = oInput.getTokens();
                    if (aTokens.length === 0) {
                        oInput.setValueState("Error");
                        oInput.setValueStateText(
                            "At least one qualification is required."
                        );
                    } else {
                        oInput.setValueState("None");
                        oInput.setValueStateText("");
                    }
                }, 0);
            },

            onCloseDialog: function () {
                const oView = this.getView();
                const oDialog = this.byId("addJobDialog");

                if (!oDialog) return;

                //  Fields to reset
                const aFieldIds = [
                    "JobTitleCombo",
                    "primarySkillsInput",
                    "experienceCombo",
                    "certificationsInput",
                    "HP_id_Country",
                    "HP_id_State",
                    "HP_id_City",
                    "positionsInput",
                    "postDateDP",
                    "workModeCombo",
                    // DO NOT include 'qualificationComb' – it's not used anywhere
                ];

                //  Reset all inputs/selects
                aFieldIds.forEach((sId) => {
                    const oControl = oView.byId(sId);
                    if (!oControl) return;

                    if (typeof oControl.setValueState === "function") {
                        oControl.setValueState("None");
                    }

                    if (typeof oControl.removeStyleClass === "function") {
                        oControl.removeStyleClass("rteError");
                    }

                    if (typeof oControl.setValue === "function") {
                        oControl.setValue("");
                    } else if (typeof oControl.setSelectedKey === "function") {
                        oControl.setSelectedKey("");
                    } else if (typeof oControl.removeAllTokens === "function") {
                        oControl.removeAllTokens();
                    }
                });

                // Reset MultiInput (Qualifications)
                const oQualMultiInput = this.byId("multiInputQualifications");
                if (oQualMultiInput) {
                    oQualMultiInput.setValueState("None");
                    oQualMultiInput.setValueStateText("");
                    oQualMultiInput.removeAllTokens();
                }

                //  Destroy RTEs inside VBoxes (since we're injecting them fresh on open)
                const aRTEBoxIds = [
                    "jobDescRTE",
                    "keyRespRTE",
                    "secondarySkillsRTE",
                    "skillReqRTE",
                ];

                aRTEBoxIds.forEach((id) => {
                    const oVBox = oView.byId(id);
                    if (oVBox) {
                        oVBox.destroyItems(); // Clears RTEs
                        oVBox.removeStyleClass("sapUiRTEErrorBorder"); // Optional: remove error styles
                    }
                });

                // Reset temporary model
                const oTempModel = oView.getModel("temporaryModel");
                if (oTempModel) {
                    oTempModel.setData({
                        JobTitle: "",
                        primarySkills: "",
                        qualifications: [],
                        experience: "",
                        certifications: "",
                        location: "",
                        positions: "",
                        postDate: null,
                        jobDescription: "",
                        workMode: "",
                        keyResponsibilities: "",
                        secondarySkills: "",
                        skillRequirements: "",
                        Status: "true",
                        SelectedJobTitleKey: "",
                        SelectedExperienceKey: "",
                        country: "",
                        state: "",
                        Location: "",
                        SelectedWorkMode: "",
                        dialogTitle: "Create Job Posting",
                        isEdit: false,
                    });
                }

                // Close dialog and reset selection
                oDialog.close();
                this.byId("jobPostingTable").removeSelections(true);
                this.onJobSelectionChange();
            },

            onRichTextChange: function (oEvent) {
                const oRTE = oEvent.getSource();
                const sId = oRTE.getId();
                const sValue = oRTE.getValue() || "";

                // Remove tags, nbsp, etc.
                const sPlainText = sValue
                    .replace(/<[^>]*>/g, "")
                    .replace(/&nbsp;/g, " ")
                    .replace(/\s+/g, "")
                    .trim();

                const oDom = document.getElementById(sId);
                if (
                    sPlainText.length > 0 &&
                    oDom?.classList.contains("sapUiRTEErrorBorder")
                ) {
                    oDom.classList.remove("sapUiRTEErrorBorder");
                }
            },

            _getRTELabel: function (rteId) {
                if (rteId.includes("jobDescRTE")) return "Job Description";
                if (rteId.includes("secondarySkillsRTE")) return "Secondary Skills";
                if (rteId.includes("keyResponsibilitiesRTE"))
                    return "Key Responsibilities";
                if (rteId.includes("skillRequirementsRTE"))
                    return "Skill Requirements";
                return "This field";
            },

            getText: function (sKey, aArgs = []) {
                return this.getView()
                    .getModel("i18n")
                    .getResourceBundle()
                    .getText(sKey, aArgs);
            },

            onSubmitJob: async function () {
                const oPayload = this._prepareJobPayload();
                if (!oPayload) return;

                this.getBusyDialog();

                try {
                    if (this._isEdit && this._editJobId) {
                        await this.ajaxUpdateWithJQuery("JobOpenings", {
                            data: oPayload,
                            filters: {
                                ID: this._editJobId
                            },
                        });
                        MessageToast.show(this.getText("jobUpdateSuccess"));
                    } else {
                        await this.ajaxCreateWithJQuery("JobOpenings", {
                            data: [oPayload],
                        });
                        MessageToast.show(this.getText("jobCreateSuccess"));
                    }

                    await this._fetchJobOpenings();

                    this.onJobSelectionChange();
                    this._cleanupDialogAfterSubmit();
                    this.onCloseDialog();
                } catch (error) {
                    const errorText =
                        error?.responseJSON?.error?.message ||
                        error?.message ||
                        this.getText("jobSubmitError");
                    MessageToast.show(errorText);
                } finally {
                    this.closeBusyDialog();
                }
            },

            _cleanupDialogAfterSubmit: function () {
                const oView = this.getView();

                // Close dialog if open
                const oDialog = oView.byId("addJobDialog");
                if (oDialog && oDialog.isOpen()) {
                    oDialog.close();
                }

                // Reset model first to avoid side effects
                const oTempModel = oView.getModel("temporaryModel");
                if (oTempModel) {
                    oTempModel.setData({});
                }

                // Remove qualification tokens safely
                const oMultiInput = oView.byId("multiInputQualifications");
                if (oMultiInput) {
                    oMultiInput.removeAllTokens();
                }

                // Clear all input/select fields
                const aFieldIds = [
                    "JobTitleCombo",
                    "primarySkillsInput",
                    "experienceCombo",
                    "certificationsInput",
                    "HP_id_Country",
                    "HP_id_State",
                    "HP_id_City",
                    "positionsInput",
                    "postDateDP",
                    "workModeCombo",
                ];

                aFieldIds.forEach((sId) => {
                    const oControl = oView.byId(sId);
                    if (!oControl) return;

                    if (typeof oControl.setValue === "function") {
                        oControl.setValue("");
                    } else if (typeof oControl.setSelectedKey === "function") {
                        oControl.setSelectedKey("");
                    } else if (typeof oControl.removeAllTokens === "function") {
                        oControl.removeAllTokens();
                    }

                    if (typeof oControl.setValueState === "function") {
                        oControl.setValueState("None");
                    }
                });

                // Reset internal state
                this._isEdit = false;
                this._editJobId = null;
            },
            onClientNameChange: function (oEvent) {
                validation._LCvalidateMandatoryField(oEvent, "oEvent");
            },

            _validateJobPostingFields: function () {
                const oView = this.getView();
                const validation = this.validation;
                const that = this;
                const isEditMode = this._isEdit;
                const oTempModel = oView.getModel("temporaryModel");
                const iJobTypeIndex = oTempModel?.getProperty("/jobTypeIndex") || 0;

                const fieldLabels = {
                    statusCombo: "Status",
                    HP_id_BranchCode: "Branch Code",
                    clientNameInput: "Client Name",
                    HP_id_Country: "Country",
                    HP_id_State: "State",
                    HP_id_City: "Location",
                    workModeCombo: "Work Mode",
                    positionsInput: "Number of Positions",
                    postDateDP: "Post Date",
                    primarySkillsInput: "Primary Skills",
                    secondarySkillsRTE: "Secondary Skills",
                    experienceCombo: "Experience",
                    multiInputQualifications: "Qualification",
                    JobTitleCombo: "Job Title",
                    certificationsInput: "Certifications",
                    jobDescRTE: "Job Description",
                    keyResponsibilitiesRTE: "Key Responsibilities",
                    skillRequirementsRTE: "Skill Requirements"
                };

                const scrollAndToast = (oCtrl, fieldName) => {
                    setTimeout(() => {
                        try {
                            const oDom =
                                oCtrl?.getFocusDomRef?.() ||
                                oCtrl?.getDomRef?.() ||
                                oCtrl?.getContentDomRef?.();
                            oDom?.scrollIntoView({
                                behavior: "smooth",
                                block: "center"
                            });
                            oCtrl?.focus?.();
                        } catch (e) { }

                        MessageToast.show(
                            fieldName ?
                                that.getText("mandetoryFields") + `: ${fieldName}` :
                                that.getText("mandetoryFields")
                        );
                    }, 80);
                };

                const validateField = (field) => {
                    const oCtrl = oView.byId(field.id);
                    if (!oCtrl || !field.validator) return true;

                    let isValid = true;

                    if (field.type === "multiinput") {
                        const aTokens = oCtrl.getTokens?.() || [];
                        isValid = field.validator(oCtrl, aTokens);
                    } else {
                        isValid = field.validator(oCtrl, "ID");
                    }

                    if (!isValid) {
                        oCtrl.setValueState("Error");
                        oCtrl.setValueStateText(
                            `${fieldLabels[field.id] || "This field"} is required`
                        );
                        scrollAndToast(oCtrl, fieldLabels[field.id] || "Field");
                        return false;
                    }

                    oCtrl.setValueState("None");
                    return true;
                };

                const validateRTE = (rteId, isMandatory) => {
                    const oVBox = Fragment.byId(oView.getId(), rteId);
                    const oRTE = oVBox?.getItems?.()[0];
                    if (!oRTE) return true;

                    const sHTML = oRTE.getValue?.() || "";
                    const sPlainText = sHTML
                        .replace(/<[^>]*>/g, "")
                        .replace(/&nbsp;/g, "")
                        .replace(/\s+/g, "")
                        .trim();
                    const isEmpty = sPlainText === "";
                    const isTooShort = sPlainText.length < 8;

                    const isInvalid =
                        (isMandatory && isEmpty) || (!isEmpty && isTooShort);

                    if (isInvalid) {
                        oVBox?.addStyleClass("sapUiRTEErrorBorder");
                        scrollAndToast(oVBox, fieldLabels[rteId] || "Rich Text Field");
                        return false;
                    }

                    oVBox?.removeStyleClass("sapUiRTEErrorBorder");
                    return true;
                };

                // (1) Recruitment type field FIRST (Branch Code OR Client Name)
                let isRecruitmentValid = true;
                if (iJobTypeIndex === 0) {
                    // Our Company: validate Branch Code first
                    isRecruitmentValid = validateField({
                        id: "HP_id_BranchCode",
                        type: "combo",
                        validator: validation._LCstrictValidationComboBox
                    });
                } else {
                    // Client Recruitment: validate Client Name first
                    isRecruitmentValid = validateField({
                        id: "clientNameInput",
                        type: "input",
                        validator: validation._LCvalidateMandatoryField
                    });
                }
                if (!isRecruitmentValid) return false;

                // (2) Core location fields
                const coreFields = [
                    ...(isEditMode ? [{
                        id: "statusCombo",
                        type: "combo",
                        validator: validation._LCstrictValidationComboBox
                    }] : []),
                    {
                        id: "HP_id_Country",
                        type: "combo",
                        validator: validation._LCstrictValidationComboBox
                    },
                    {
                        id: "HP_id_State",
                        type: "combo",
                        validator: validation._LCstrictValidationComboBox
                    },
                    {
                        id: "HP_id_City",
                        type: "combo",
                        validator: function (oCtrl) {
                            const sKey = oCtrl.getSelectedKey?.() || "";
                            const oSelectedItem = oCtrl.getSelectedItem?.();

                            if (!sKey || !oSelectedItem) {  //  Correct check
                                oCtrl.setValueState("Error");
                                oCtrl.setValueStateText("Location is required.");
                                return false;
                            }

                            oCtrl.setValueState("None");
                            return true;
                        }
                    },
                    {
                        id: "workModeCombo",
                        type: "combo",
                        validator: validation._LCstrictValidationComboBox
                    },
                    {
                        id: "positionsInput",
                        type: "input",
                        validator: validation._LCvalidateAmountZeroTaking
                    },
                    {
                        id: "postDateDP",
                        type: "date",
                        validator: validation._LCvalidateMandatoryField
                    }
                ];
                for (const field of coreFields) {
                    if (!validateField(field)) return false;
                }

                // (3) Experience and Qualification after Post Date
                if (!validateField({
                    id: "experienceCombo",
                    type: "combo",
                    validator: validation._LCstrictValidationComboBox
                })) return false;

                //    for (const field of qualificationFlowFields) {
                //     if (!validateField(field)) return false;
                // }

                // (3) Primary Skills (Input) - NEXT
                if (!validateField({
                    id: "primarySkillsInput",
                    type: "input",
                    validator: function (oCtrl) {
                        const sValue = oCtrl.getValue().trim();

                        if (!sValue) {
                            oCtrl.setValueState("Error");
                            oCtrl.setValueStateText("Primary Skills are required.");
                            return false;
                        }

                        if (sValue.length < 2) {
                            oCtrl.setValueState("Error");
                            oCtrl.setValueStateText("Minimum 2 characters are required.");
                            return false;
                        }

                        if (sValue.length > 100) {
                            oCtrl.setValueState("Error");
                            oCtrl.setValueStateText("Maximum 100 characters allowed.");
                            return false;
                        }

                        oCtrl.setValueState("None");
                        return true;
                    }
                })) return false;

                // (4) Secondary Skills RTE (mandatory) - IMMEDIATELY AFTER Primary Skills
                if (!validateRTE("secondarySkillsRTE", true)) return false;

                if (!validateField({
                    id: "multiInputQualifications",
                    type: "multiinput",
                    validator: (oCtrl) => oCtrl.getTokens?.().length > 0
                })) return false;

                // (5) Experience, Qualification, Job Title
                const secondFields = [

                    {
                        id: "JobTitleCombo",
                        type: "input",
                        validator: function (oCtrl) {
                            const sValue = oCtrl?.getValue?.()?.trim() || "";

                            if (!sValue) {
                                oCtrl.setValueState("Error");
                                oCtrl.setValueStateText("Job Title is required.");
                                return false;
                            }

                            if (sValue.length < 2) {
                                oCtrl.setValueState("Error");
                                oCtrl.setValueStateText("Job Title must be at least 2 characters.");
                                return false;
                            }

                            oCtrl.setValueState("None");

                            const oModel = oCtrl.getModel("temporaryModel");
                            if (oModel) {
                                oModel.setProperty("/SelectedJobTitleValue", sValue);
                            }

                            return true;
                        }
                    }
                ];

                for (const field of secondFields) {
                    if (!validateField(field)) return false;
                }

                // (6) Certifications (optional but formatted)
                const certInput = oView.byId("certificationsInput");
                if (certInput) {
                    const sValue = certInput.getValue();
                    const trimmedValue = sValue.trim();

                    if (sValue.length === 0) {
                        certInput.setValueState("None");
                    } else {
                        const isOnlySpacesOrDots = /^[.\s]+$/.test(sValue);

                        if (trimmedValue.length < 2 || isOnlySpacesOrDots) {
                            certInput.setValueState("Error");
                            certInput.setValueStateText(
                                "Minimum 2 characters, and cannot be just spaces or dots."
                            );
                            scrollAndToast(certInput, fieldLabels["certificationsInput"]);
                            return false;
                        }

                        if (trimmedValue.length > 100) {
                            certInput.setValueState("Error");
                            certInput.setValueStateText("Maximum 100 characters allowed.");
                            scrollAndToast(certInput, fieldLabels["certificationsInput"]);
                            return false;
                        }

                        certInput.setValueState("None");
                    }
                }

                // (7) Job Description (mandatory)
                if (!validateRTE("jobDescRTE", true)) return false;

                // (8) Optional RTEs (blank OR >=8 chars) - Skill Requirements included
                const optionalRTEs = ["keyRespRTE", "skillReqRTE"];

                for (const rteId of optionalRTEs) {
                    const oVBox = Fragment.byId(oView.getId(), rteId);
                    const oRTE = oVBox?.getItems?.()[0];
                    if (!oVBox || !oRTE) continue;

                    const html = oRTE.getValue?.() || "";
                    const plain = html
                        .replace(/<[^>]*>/g, "")
                        .replace(/&nbsp;/g, "")
                        .replace(/\s+/g, "")
                        .trim();

                    const isFilled = plain.length > 0;
                    const isTooShort = plain.length < 8;

                    if (isFilled && isTooShort) {
                        oVBox.addStyleClass("sapUiRTEErrorBorder");
                        scrollAndToast(oVBox, fieldLabels[rteId] || "Rich Text Field");
                        return false;
                    }

                    if (!isFilled || !isTooShort) {
                        oVBox.removeStyleClass("sapUiRTEErrorBorder");
                    }
                }

                // (9) Final failsafe checks for optional RTEs
                for (const rteId of optionalRTEs) {
                    const oVBox = Fragment.byId(oView.getId(), rteId);
                    if (oVBox?.hasStyleClass("sapUiRTEErrorBorder")) {
                        scrollAndToast(oVBox, fieldLabels[rteId] || "Rich Text Field");
                        return false;
                    }
                }

                for (const rteId of optionalRTEs) {
                    const oVBox = Fragment.byId(oView.getId(), rteId);
                    const oDom = oVBox?.getDomRef?.();
                    if (oDom?.classList.contains("sapUiRTEErrorBorder")) {
                        scrollAndToast(oVBox, fieldLabels[rteId] || "Rich Text Field");
                        return false;
                    }
                }

                return true;
            },

            _prepareJobPayload: function () {
                if (!this._validateJobPostingFields()) return null;

                const oView = this.getView();
                const oModel =
                    oView.getModel("temporaryModel") ||
                    sap.ui.core.Fragment.byId(oView.getId(), "addJobDialog")?.getModel(
                        "temporaryModel"
                    );

                if (!oModel) {
                    MessageToast.show("Unexpected error. Please reopen the dialog.");
                    return null;
                }

                //  Sync RTEs
                const aRTEs = [{
                    vboxId: "jobDescRTE",
                    prop: "JobDescription"
                },
                {
                    vboxId: "keyRespRTE",
                    prop: "KeyResponsibilities"
                },
                {
                    vboxId: "secondarySkillsRTE",
                    prop: "SecondarySkills"
                },
                {
                    vboxId: "skillReqRTE",
                    prop: "SkillRequirements"
                },
                ];

                aRTEs.forEach(({
                    vboxId,
                    prop
                }) => {
                    const oVBox = oView.byId(vboxId);
                    const oRTE = oVBox?.getItems?.()[0];
                    if (oRTE && typeof oRTE.getValue === "function") {
                        oModel.setProperty("/" + prop, oRTE.getValue());
                    }
                });

                //  Sync fallback ComboBox/Input values
                const fallbackFields = {
                    SelectedJobTitleKey: oView.byId("JobTitleCombo")?.getValue()?.trim() || "",
                    SelectedExperienceKey: (oView.byId("experienceCombo")?.getSelectedKey() || "") === "Fresher"
                        ? "0"
                        : (oView.byId("experienceCombo")?.getSelectedKey() || ""),
                    Status: oView.byId("statusCombo")?.getSelectedKey() || "",
                    NoOfPositions: oView.byId("positionsInput")?.getValue()?.trim() || "",
                    PrimarySkills: oView.byId("primarySkillsInput")?.getValue()?.trim() || "",
                    Certifications: oView.byId("certificationsInput")?.getValue()?.trim() || "",
                    BranchCode: oView.byId("HP_id_BranchCode")?.getValue()?.trim() || "",
                };

                Object.entries(fallbackFields).forEach(([path, value]) => {
                    if (!oModel.getProperty("/" + path)) {
                        oModel.setProperty("/" + path, value);
                    }
                });

                const oData = oModel.getData();
                const sUserName = this.getOwnerComponent()
                    .getModel("LoginModel")
                    .getProperty("/EmployeeName");
                const sUserID = this.getOwnerComponent()
                    .getModel("LoginModel")
                    .getProperty("/EmployeeID");

                return {
                    BranchCode: oData.branchCode || "",
                    ClientName: oData.clientName || "",
                    JobTitle: oView.byId("JobTitleCombo")?.getValue()?.trim() || "",
                    RecruitmentType: oData.jobTypeIndex === 0 ? "Our Company" : "Client Recruitment",
                    jobDescription: oData.JobDescription,
                    keyResponsibilities: oData.KeyResponsibilities || "",
                    primarySkills: oData.PrimarySkills,
                    secondarySkills: oData.SecondarySkills,
                    skillRequirements: oData.SkillRequirements || "",
                    qualification: (oData.qualifications || []).join(", "),
                    experience: fallbackFields.SelectedExperienceKey,
                    certifications: oData.Certifications || "",
                    country: oData.country || "",
                    state: oData.state || "",
                    Location: oData.Location || "",
                    LocationService: this.byId("workModeCombo")?.getSelectedItem()?.getText()?.trim() || "",
                    NoOfPositions: parseInt(oData.NoOfPositions, 10) || 0,
                    postDate: oData.PostDate,
                    Status: oData.Status,
                    CreatedBy: `${sUserName} (${sUserID})`,
                };
            },

            _setDatePickerRange: function () {
                const oDatePicker = this.byId("postDateDP");
                if (oDatePicker) {
                    const oToday = new Date();
                    const oMinDate = new Date();
                    oMinDate.setFullYear(oToday.getFullYear() - 20);
                    oDatePicker.setMinDate(oMinDate);
                    oDatePicker.setMaxDate(oToday);
                }
            },

            onDeleteJob: function () {
                const oTable = this.byId("jobPostingTable");
                const aSelectedItems = oTable.getSelectedItems();

                if (aSelectedItems.length === 0) {
                    MessageToast.show("Please select a job posting to delete");
                    return;
                }

                const oSelectedItem = aSelectedItems[0];
                const oContext = oSelectedItem.getBindingContext("JobApplicationModel");
                const oJobData = oContext?.getObject?.() || {};

                if (!oJobData.ID) {
                    MessageToast.show("Selected item has no valid ID for deletion.");
                    return;
                }

                const sPayload = {
                    filters: {
                        ID: oJobData.ID
                    }
                };

                this.showConfirmationDialog(
                    this.i18na.getText("confirmTitle") || "Confirm Deletion",
                    this.i18na.getText("DeleteJPMessage"),
                    async () => {
                        this.getBusyDialog();
                        try {
                            await this.ajaxDeleteWithJQuery("JobOpenings", sPayload);
                            MessageToast.show(this.i18na.getText("DeleteJPSucces"));
                            this._fetchJobOpenings();
                            oTable.removeSelections(true);
                            this.onJobSelectionChange();
                        } catch (error) {
                            MessageToast.show(
                                "Failed to delete job: " +
                                (error?.responseJSON?.message ||
                                    "Please check backend logs")
                            );
                        } finally {
                            this.closeBusyDialog();
                        }
                    },
                    () => {
                        oTable.removeSelections(true);
                        this.onJobSelectionChange();
                    }
                );
            },

            onFilterSearch: async function () {
                const oView = this.getView();
                const aFilterItems =
                    this.byId("filterBar")?.getFilterGroupItems() || [];

                const oFilterPayload = {
                    PrimarySkills: "",
                    Experience: "",
                    Location: "",
                    Status: "",
                };

                let sStartDate = "";
                let sEndDate = "";

                aFilterItems.forEach((oItem) => {
                    const sFieldName = oItem.getName();
                    const oControl = oItem.getControl();
                    if (!oControl) return;

                    switch (sFieldName) {
                        case "Skills":
                            oFilterPayload.PrimarySkills =
                                oControl.getValue()?.trim() || "";
                            break;

                        case "Experience": {
                            const oSelectedItem = oControl.getSelectedItem();
                            const sExpVal = oSelectedItem
                                ?.getBindingContext("ExperienceModel")
                                ?.getObject()?.value;
                            oFilterPayload.Experience = sExpVal === "Fresher" ? "0-0" : (sExpVal || "")
                            break;
                        }

                        case "Location": {
                            const sLocKey = oControl.getSelectedKey();
                            if (sLocKey) {
                                const aLocations = this.getView().getModel("FilterJobModel")?.getProperty("/LocationSet") || [];
                                const oLoc = aLocations.find((loc) => loc.Location === sLocKey);
                                oFilterPayload.Location = oLoc?.Location || "";
                            }
                            break;
                        }

                        case "Status":
                            oFilterPayload.Status = oControl.getSelectedKey() || "";
                            break;

                        case "PostDate": {
                            const oDateRange = oControl.getDateValue(); // Start date
                            const oSecondDate = oControl.getSecondDateValue(); // End date

                            if (oDateRange && oSecondDate) {
                                const oDateFormat =
                                    sap.ui.core.format.DateFormat.getDateInstance({
                                        pattern: "yyyy-MM-dd",
                                    });
                                sStartDate = oDateFormat.format(oDateRange);
                                sEndDate = oDateFormat.format(oSecondDate);
                            }
                            break;
                        }
                    }
                });

                const bEmpty =
                    Object.values(oFilterPayload).every((val) => !val) &&
                    !sStartDate &&
                    !sEndDate;

                if (bEmpty) {
                    this._fetchJobOpenings();
                    this._setBackendStatusModel();
                    return;
                }

                try {
                    this.getBusyDialog();
                    const oResponse = await this.ajaxReadWithJQuery("JobOpenings", {
                        ...oFilterPayload,
                        StartDate: sStartDate,
                        EndDate: sEndDate,
                    });

                    const aData = oResponse?.data || [];

                    if (aData.length === 0) {
                        MessageToast.show(
                            this.getText("noMatchingResults") ||
                            "No matching records found."
                        );
                    }

                    oView.setModel(
                        new JSONModel({
                            Candidates: aData
                        }),
                        "JobApplicationModel"
                    );
                } catch (err) {
                    this.showMessage(
                        "fetchError",
                        " " + (err?.responseJSON?.message || err?.message)
                    );
                } finally {
                    this.closeBusyDialog();
                }
            },

            onSuggestSkills: function (oEvent) {
                const sValue =
                    oEvent.getParameter("suggestValue")?.toLowerCase() || "";

                const aTableData =
                    this.getView()
                        .getModel("JobApplicationModel")
                        ?.getProperty("/Candidates") || [];

                // Flatten and extract all skills
                const aMatchedSkills = aTableData
                    .map((item) => item.PrimarySkills?.split(",") || [])
                    .flat()
                    .map((skill) => skill.trim())
                    .filter((skill) => skill.toLowerCase().includes(sValue));

                //  Remove duplicates
                const aUniqueSkills = [...new Set(aMatchedSkills)];

                // Convert to suggestion item format
                const aSuggestionItems = aUniqueSkills.map((skill) => ({
                    skill
                }));

                // Bind to model
                const oSuggestModel = new JSONModel({
                    skills: aSuggestionItems,
                });
                this.getView().setModel(oSuggestModel, "skillModel");
            },

            v1_filClear: function () {
                this.byId("HP_id_LocationFilter").setSelectedKey("");
                this.byId("filterExperienceJP").setSelectedKey("");
                this.byId("filterStatus").setSelectedKey("");
                this.byId("filterPrimarySkills").setValue("");
                this.byId("filterPostDate").setValue("");
            },

            onNoOfPositionsChange: function (oEvent) {
                const oInput = oEvent.getSource();
                let sValue = oInput.getValue();

                sValue = sValue.replace(/\D/g, "").replace(/^0+/, "");

                if (sValue.length > 2) {
                    sValue = sValue.substring(0, 2);
                }

                const iValue = parseInt(sValue, 10);
                if (!iValue || iValue < 1 || iValue > 99) {
                    oInput.setValueState("Error");
                    oInput.setValueStateText(
                        "Number of Positions Required\nEnter a number between 1 and 99 (no leading zero)."
                    );
                } else {
                    oInput.setValueState("None");
                }

                oInput.setValue(sValue);

                //  Update model
                this.getView()
                    .getModel("temporaryModel")
                    .setProperty("/NoOfPositions", sValue);
            },

            onPostDateChange: function (oEvent) {
                const oDatePicker = oEvent.getSource();
                const oDate = oDatePicker.getDateValue();
                const oToday = new Date();
                const oMinDate = new Date();
                oMinDate.setFullYear(oToday.getFullYear() - 20);

                if (!oDate || isNaN(oDate.getTime())) {
                    oDatePicker.setValueState("Error");
                    oDatePicker.setValueStateText("Please select a valid date");
                } else if (oDate < oMinDate || oDate > oToday) {
                    oDatePicker.setValueState("Error");
                    oDatePicker.setValueStateText(
                        "Date must be within the last 20 years and not in the future"
                    );
                } else {
                    oDatePicker.setValueState("None");
                }

                setTimeout(() => {
                    oDatePicker.$().find("input").attr("readonly", true);
                }, 0);
            },

            onPrimarySkillsChange: function (oEvent) {
                const oInput = oEvent.getSource();
                const sValue = oEvent.getParameter("value") || "";
                const oModel = oInput.getModel("temporaryModel");

                // Mandatory check
                if (!sValue.trim()) {
                    oInput.setValueState("Error");
                    oInput.setValueStateText("Primary Skills are required.");
                    oModel?.setProperty("/PrimarySkills", "");
                    return;
                }

                // Min length check
                if (sValue.trim().length < 2) {
                    oInput.setValueState("Error");
                    oInput.setValueStateText("Minimum 2 characters are required.");
                    oModel?.setProperty("/PrimarySkills", sValue);
                    return;
                }

                // Max length
                if (sValue.length > 100) {
                    oInput.setValueState("Error");
                    oInput.setValueStateText("Maximum 100 characters allowed.");
                    oModel?.setProperty("/PrimarySkills", sValue);
                    return;
                }

                oInput.setValueState("None");
                oModel?.setProperty("/PrimarySkills", sValue);
            },

            onCertificationChange: function (oEvent) {
                const oInput = oEvent.getSource();
                const sValue = oEvent.getParameter("value") || "";

                // Allow empty (optional field)
                if (sValue.trim() === "" && sValue.length === 0) {
                    oInput.setValueState("None");
                    this._updateCertModel(oInput, "");
                    return;
                }

                const trimmedValue = sValue.trim();

                // New check for only spaces or dots
                const isOnlySpacesOrDots = /^[.\s]+$/.test(sValue);

                if (trimmedValue.length < 2 || isOnlySpacesOrDots) {
                    oInput.setValueState("Error");
                    oInput.setValueStateText(
                        "Minimum 2 characters, and cannot be just spaces or dots."
                    );
                    return;
                }

                // Max length check
                if (trimmedValue.length > 100) {
                    oInput.setValueState("Error");
                    oInput.setValueStateText("Maximum 100 characters allowed.");
                    return;
                }

                // Set success state and update model
                oInput.setValueState("None");
                this._updateCertModel(oInput, trimmedValue);
            },

            // Helper for safe model update
            _updateCertModel: function (oInput, value) {
                const oModel = oInput.getModel("temporaryModel");
                if (oModel) {
                    oModel.setProperty("/Certifications", value);
                } else {
                    MessageToast.show("Form not initialized properly.");
                }
            },

            onJobSelectionChange: function () {
                var aSelectedItems = this.byId("jobPostingTable").getSelectedItems();
                if (aSelectedItems.length > 0) {
                    this.byId("HP_id_create").setEnabled(false);
                    this.byId("HP_id_edit").setEnabled(true);
                    this.byId("HP_id_delete").setEnabled(true);
                } else {
                    this.byId("HP_id_create").setEnabled(true);
                    this.byId("HP_id_edit").setEnabled(true);
                    this.byId("HP_id_delete").setEnabled(true);
                }
            },

            onStatusChange: function (oEvent) {
                this.validation._LCstrictValidationComboBox(oEvent);
                const sKey = oEvent.getSource().getSelectedKey();
                this.getView().getModel("temporaryModel").setProperty("/Status", sKey);
            },

            onWorkModeChange: function (oEvent) {
                this.validation._LCstrictValidationComboBox(oEvent);
            },

            onExperienceChange: function (oEvent) {
                this.validation._LCstrictValidationComboBox(oEvent);
                const sKey = oEvent.getSource().getSelectedKey();
                this.getView().getModel("temporaryModel").setProperty("/SelectedExperienceKey", sKey);
            },

            onQualificationsChange: function (oEvent) {
                this.validation._LCstrictValidationComboBox(oEvent);
            },

            onJobTitleChange: function (oEvent) {
                const oComboBox = oEvent.getSource();
                const sValue = oComboBox.getValue()?.trim();
                const oModel = this.getView().getModel("temporaryModel");

                if (!sValue) {
                    oComboBox.setValueState("Error");
                    oComboBox.setValueStateText("Job Title is required.");
                    return;
                }
                if (sValue.length < 2) {
                    oComboBox.setValueState("Error");
                    oComboBox.setValueStateText(
                        "Job Title must be at least 2 characters."
                    );
                    return false;
                }
                oComboBox.setValueState("None");

                // Save typed value directly
                if (oModel) {
                    oModel.setProperty("/SelectedJobTitleValue", sValue); // Store value
                }
            },

            _LCvalidateMultiInput: function (oMultiInput, aTokens) {
                if (!oMultiInput || !aTokens) return false;

                if (aTokens.length === 0) {
                    oMultiInput.setValueState("Error");
                    oMultiInput.setValueStateText(
                        "At least one selection is required."
                    );
                    oMultiInput
                        .getDomRef()
                        ?.scrollIntoView({
                            behavior: "smooth",
                            block: "center"
                        });
                    return false;
                } else {
                    oMultiInput.setValueState("None");
                    oMultiInput.setValueStateText("");
                    return true;
                }
            },

            onOpenQualificationsDialog: function () {
                const oView = this.getView();
                const oModel = oView.getModel("temporaryModel");

                if (!oModel) {
                    MessageToast.show(
                        "Form model not initialized. Please reopen the dialog."
                    );
                    return;
                }

                if (!this._oQualificationDialog) {
                    Fragment.load({
                        name: "sap.kt.com.minihrsolution.fragment.SelectQualificationsDialog",
                        id: oView.getId(),
                        controller: this,
                    }).then((oDialog) => {
                        this._oQualificationDialog = oDialog;
                        oView.addDependent(oDialog);

                        // Set the model here explicitly
                        oDialog.setModel(oModel, "temporaryModel");

                        oDialog.open();
                    });
                } else {
                    // Re-attach model in case it's refreshed
                    this._oQualificationDialog.setModel(oModel, "temporaryModel");
                    this._oQualificationDialog.open();
                }
            },

            onConfirmQualifications: function (oEvent) {
                const oInput = this.byId("multiInputQualifications");
                const oModel = this.getView().getModel("temporaryModel");

                const aSelectedItems = oEvent.getParameter("selectedItems") || [];
                const aValues = aSelectedItems.map((item) => item.getTitle());

                // Inject tokens manually
                oInput.removeAllTokens();
                aValues.forEach((text) => {
                    oInput.addToken(new sap.m.Token({
                        text
                    }));
                });

                // Validate tokens now
                const isValid = this._LCvalidateMultiInput(
                    oInput,
                    oInput.getTokens()
                );
                if (!isValid) return;

                //  Update model
                if (oModel) {
                    oModel.setProperty("/qualifications", aValues);
                } else {
                    MessageToast.show("Form model not initialized.");
                }
            },

            onSearchQualifications: function (oEvent) {
                const sQuery = oEvent.getParameter("value");
                const oFilter = new sap.ui.model.Filter(
                    "",
                    sap.ui.model.FilterOperator.Contains,
                    sQuery
                );
                oEvent.getSource().getBinding("items").filter([oFilter]);
            },

            _mapRTEFieldIdToModelProp: function (id) {
                const map = {
                    jobDescRTE: "JobDescription",
                    keyRespRTE: "KeyResponsibilities",
                    secondarySkillsRTE: "SecondarySkills",
                    skillReqRTE: "SkillRequirements",
                };
                return map[id] || id;
            },

            _attachRTEListeners: function (sRTEId, bMandatory) {
                const oRTE = this.byId(sRTEId);
                if (!oRTE || !bMandatory) {
                    return;
                }

                oRTE.attachChange(() => {
                    const sValue = oRTE.getValue() || "";

                    // Strip HTML, &nbsp;, and whitespace
                    const sPlainText = sValue
                        .replace(/<[^>]*>/g, "")
                        .replace(/&nbsp;/g, " ")
                        .replace(/\s+/g, "")
                        .trim();

                    if (sPlainText.length > 0) {
                        const oDomRef = oRTE.getDomRef();
                        if (oDomRef?.classList.contains("sapUiRTEErrorBorder")) {
                            oDomRef.classList.remove("sapUiRTEErrorBorder");
                        }
                    }
                });

            },

            HP_DownloadTableData: function () {
                var table = this.byId("jobPostingTable");
                const oModelData = table.getModel("JobApplicationModel").getData().Candidates;
                var exportPayload = [];
                oModelData.map(item => {
                    exportPayload.push({
                        ...item,
                        PostDate: formatter.formatDate(item.PostDate),
                        StatusExport: item.Status === "true" ? "Active" : "Inactive"
                    });
                });

                const aCols = [{
                    label: this.i18nModel.getText("Jobtitle"),
                    property: "JobTitle",
                    type: "string"
                },
                {
                    label: this.i18nModel.getText("branchCode"),
                    property: "BranchCode",
                    type: "string"
                },
                {
                    label: this.i18nModel.getText("v1_PriSkills"),
                    property: "PrimarySkills",
                    type: "string"
                },
                {
                    label: this.i18nModel.getText("HP_t_Workmode"),
                    property: "LocationService",
                    type: "string"
                },
                {
                    label: this.i18nModel.getText("TableColExperience"),
                    property: "Experience",
                    type: "string"
                },
                {
                    label: this.i18nModel.getText("V1_L_Location"),
                    property: "Location",
                    type: "string"
                },
                {
                    label: this.i18nModel.getText("HP_t_NoOfPos"),
                    property: "NoOfPositions",
                    type: "string "
                },
                {
                    label: this.i18nModel.getText("status"),
                    property: "StatusExport",
                    type: "string"
                },
                ];
                const oSettings = {
                    workbook: {
                        columns: aCols,
                        context: {
                            sheetName: this.i18nModel.getText("jobdetails")
                        }
                    },
                    dataSource: exportPayload,
                    fileName: "Job_Detail.xlsx"
                };
                const oSheet = new Spreadsheet(oSettings);
                oSheet.build().then(function () {
                    MessageToast.show(this.i18nModel.getText("downloadsuccessfully"));
                }.bind(this))
                    .finally(function () {
                        oSheet.destroy();
                    });
            }
        }
        );
    }
);