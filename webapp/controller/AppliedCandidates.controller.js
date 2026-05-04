sap.ui.define(["./BaseController", "sap/ui/model/json/JSONModel", "sap/ui/model/Filter", "sap/m/MessageToast", "../model/formatter", "../utils/validation", "sap/ui/export/Spreadsheet", "sap/ui/core/Fragment"], function(BaseController, JSONModel, Filter, MessageToast, formatter, utils, Spreadsheet, Fragment) {
    return BaseController.extend("sap.kt.com.minihrsolution.controller.AppliedCandidates", {
        formatter: formatter,
        onInit: function() {
            const router = this.getOwnerComponent().getRouter();
            router.getRoute("AppliedCandidates").attachPatternMatched(this._onObjectMatched, this);
        },
        _onObjectMatched: async function (oEvent) {
    var LoginFUnction = await this.commonLoginFunction("AppliedCandidates");
    if (!LoginFUnction) return;

    const oArgs = oEvent.getParameter("arguments") || {};
    const bFromTile = oArgs.value === "Candidates";

    this.i18na = this.getOwnerComponent().getModel("i18n").getResourceBundle();

    this.getView().setModel(new JSONModel({
        minnDate: new Date(),
        maxDates: new Date(new Date().setDate(new Date().getDate() + 30))
    }), "myyModel");

    this.getView().setModel(new JSONModel({
        NameState: "None",
        ExpectedCTCState: "None",
        CurrentCTCState: "None",
        AvailableForInterviewState: "None",
        NoticePeriodState: "None",
        MobileNumberState: "None",
        DateState: "None",
        EmailIDState: "None",
        ExperienceState: "None",
        RemarkState: "None",
        SkillsState: "None",
        City: "None"
    }), "modelValuStateError");

    this.getView().setModel(new JSONModel({
        Editable: true
    }), "EditableModeltruefalse");

    this.getView().setModel(new JSONModel({
        results: [
            { key: "YES", text: "YES" },
            { key: "NO", text: "NO" }
        ]
    }), "setInterviewYesNo");

    this.getView().setModel(new JSONModel({
        isEditMode: false,
        busy: false,
        filteredCount: 0
    }), "viewModel");

    if (!this.getView().getModel("filterStateModel")) {
        this.getView().setModel(new JSONModel({
            employeeName: "",
            noticePeriod: "",
            skills: "",
            experience: "",
            createDateFrom: null,
            createDateTo: null
        }), "filterStateModel");
    }

    await this.AC_ReadCall();
    // this._restoreFilterState();
    this.onFilterBarSearch();

    // setTimeout(() => {
    //     this._applySavedFilters();
    // }, 0);

    if (bFromTile) {
        this._clearSavedFilterState();
        this._clearFilterControls();
        this._clearTableFilters();
    } else {
        this._restoreFilterState();
        this._applySavedFilters();
    }
    this.getView().getModel("LoginModel").setProperty("/HeaderName", this.i18na.getText("TableHeader"));
    this._FragmentDatePickersReadOnly(["FM_Id_DateAvlForInterview"]);
    this.initializeBirthdayCarousel();
},
_clearSavedFilterState: function () {
    this.getView().getModel("filterStateModel").setData({
        employeeName: "",
        noticePeriod: "",
        skills: "",
        experience: "",
        createDateFrom: null,
        createDateTo: null
    });
},
_clearFilterControls: function () {
    this.byId("filterEmployeeName")?.setValue("");
    this.byId("filterNoticePeriod")?.setValue("");
    this.byId("filterSkills")?.setValue("");
    this.byId("filterExperience")?.setValue("");

    const oDateRange = this.byId("filterCreateDate");
    if (oDateRange) {
        oDateRange.setDateValue(null);
        oDateRange.setSecondDateValue(null);
    }
},
_clearTableFilters: function () {
    const oBinding = this.byId("appliedCandidatesTable")?.getBinding("items");
    if (oBinding) {
        oBinding.filter([], sap.ui.model.FilterType.Application);
        this.getView().getModel("viewModel").setProperty("/filteredCount", oBinding.getLength());
    }
},
_applySavedFilters: function () {
    const oTable = this.byId("appliedCandidatesTable");
    const oBinding = oTable && oTable.getBinding("items");
    if (!oBinding) {
        return;
    }

    const oFilterData = this.getView().getModel("filterStateModel").getData();
    const aFilters = [];
    const Filter = sap.ui.model.Filter;
    const FilterOperator = sap.ui.model.FilterOperator;
    const oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
        pattern: "yyyy-MM-dd"
    });

    if (oFilterData.employeeName) {
        aFilters.push(new Filter("FullName", FilterOperator.Contains, oFilterData.employeeName));
    }

    if (oFilterData.skills) {
        aFilters.push(new Filter("Skills", FilterOperator.Contains, oFilterData.skills));
    }

    if (oFilterData.noticePeriod) {
        const sNoticePeriodInput = oFilterData.noticePeriod;
        aFilters.push(new Filter({
            path: "NoticePeriod",
            test: function (sDataValue) {
                if (!sDataValue || !sNoticePeriodInput) return false;
                const data = sDataValue.toString().trim();
                const input = sNoticePeriodInput.toString().trim();

                if (!input.includes("-")) {
                    return data.toLowerCase() === input.toLowerCase();
                }

                if (data.toLowerCase() === input.toLowerCase()) {
                    return true;
                }

                if (!data.includes("-")) {
                    const numData = parseInt(data, 10);
                    const parts = input.split("-");
                    const min = parseInt(parts[0].trim(), 10);
                    const max = parseInt(parts[1].trim(), 10);

                    if (isNaN(numData) || isNaN(min) || isNaN(max)) return false;
                    return numData >= min && numData <= max;
                }

                return false;
            }
        }));
    }

    if (oFilterData.experience) {
        const sExperienceInput = oFilterData.experience;
        aFilters.push(new Filter({
            path: "Experience",
            test: function (sDataValue) {
                const input = sExperienceInput.toString().trim();

                if (!input.includes("-")) {
                    const data = sDataValue ? sDataValue.toString().trim() : "";
                    return data.toLowerCase() === input.toLowerCase();
                }

                const parts = input.split("-");
                const min = parseFloat(parts[0].trim());
                const max = parseFloat(parts[1].trim());
                if (isNaN(min) || isNaN(max)) return false;

                const data = sDataValue ? sDataValue.toString().trim() : "0";
                const numData = parseFloat(data);
                if (isNaN(numData)) return false;

                return numData >= min && numData <= max;
            }
        }));
    }

    if (oFilterData.createDateFrom && oFilterData.createDateTo) {
        const sStart = oDateFormat.format(new Date(oFilterData.createDateFrom));
        const sEnd = oDateFormat.format(new Date(oFilterData.createDateTo));
        aFilters.push(new Filter("CreateDate", FilterOperator.BT, sStart, sEnd));
    }

    oBinding.filter(aFilters, sap.ui.model.FilterType.Application);
    this.getView().getModel("viewModel").setProperty("/filteredCount", oBinding.getLength());
},
_restoreFilterState: function () {
    const oData = this.getView().getModel("filterStateModel").getData();

    this.byId("filterEmployeeName")?.setValue(oData.employeeName || "");
    this.byId("filterNoticePeriod")?.setValue(oData.noticePeriod || "");
    this.byId("filterSkills")?.setValue(oData.skills || "");
    this.byId("filterExperience")?.setValue(oData.experience || "");

    const oDateRange = this.byId("filterCreateDate");
    if (oDateRange) {
        oDateRange.setDateValue(oData.createDateFrom ? new Date(oData.createDateFrom) : null);
        oDateRange.setSecondDateValue(oData.createDateTo ? new Date(oData.createDateTo) : null);
    }
},
      onTableUpdateFinished: function (oEvent) {
    const oTable = oEvent.getSource();
    const oBinding = oTable.getBinding("items");

    const iCount = oBinding.getLength(); // always gives visible rows

    this.getView().getModel("viewModel").setProperty("/filteredCount", iCount);
},
        getFragmentControl: function(sControlId) {
            let oControl = sap.ui.getCore().byId("myDialog--" + sControlId);

            if (!oControl) {
                oControl = sap.ui.getCore().byId(sControlId);
            }

            return oControl;
        },
        myFilterCombo: function(sComboBoxId, sField, sValue) {
            const oCombo = this.getFragmentControl(sComboBoxId);

            const oBinding = oCombo.getBinding("items");
            if (oBinding) {
                oBinding.filter([new sap.ui.model.Filter(sField, "EQ", sValue)]);
            }
        },
        myOnCountryChange: function(oEvent) {
            const oCombo = oEvent.getSource();
            const sSelectedCountry = oCombo.getSelectedKey();
            const oCountryModel = this.getView().getModel("CountryModel");
            const aCountries = oCountryModel.getData();

            this.myResetCountryDependencies();

            if (!sSelectedCountry) {
                return;
            }

            const oMatch = aCountries.find((c) => {
                return c.countryName === sSelectedCountry;
            });

            if (!oMatch) {
                oCombo.setValueState(sap.ui.core.ValueState.Error);
                oCombo.setValueStateText("Invalid country");
                return;
            }

            oCombo.setValueState(sap.ui.core.ValueState.None);
            oCombo.setValueStateText("");

            const oStuDataModel = this.getView().getModel("stuDataModel");
            oStuDataModel.setProperty("/Country", oMatch.countryName);

            this.myFilterCombo("FM_Id_State", "countryCode", oMatch.code);

            this.myFilterCombo("HQD_id_mFM_Id_STDCodeobileNumber", "code", oMatch.code);

            this.mySetMobileMaxLength(oMatch.code);

            this.myAutoSelectISD(oMatch.code);
        },
        myResetCountryDependencies: function() {
            const oStuDataModel = this.getView().getModel("stuDataModel");
            if (oStuDataModel) {
                oStuDataModel.setProperty("/State", "");
                oStuDataModel.setProperty("/City", "");
                oStuDataModel.setProperty("/Mobile", "");
            }

            const oStateCombo = this.getFragmentControl("FM_Id_State");
            if (oStateCombo) {
                oStateCombo.setSelectedKey("");
                const oStateBinding = oStateCombo.getBinding("items");
                if (oStateBinding) {
                    oStateBinding.filter([]);
                }
            }

            const oCityCombo = this.getFragmentControl("FM_Id_City");
            if (oCityCombo) {
                oCityCombo.setSelectedKey("");
                const oCityBinding = oCityCombo.getBinding("items");
                if (oCityBinding) {
                    oCityBinding.filter([]);
                }
            }

            const oMobile = this.getFragmentControl("FM_Id_MobileNumber");
            if (oMobile) {
                oMobile.setValue("");
                oMobile.setValueState(sap.ui.core.ValueState.None);
                oMobile.setValueStateText("");
            }
        },
        mySetMobileMaxLength: function(sCountryCode) {
            const oMobileInput = this.getFragmentControl("FM_Id_MobileNumber");
            if (!oMobileInput) return;

            const iMaxLength = (sCountryCode || "").trim().toUpperCase() === "IN" ? 10 : 20;
            oMobileInput.setMaxLength(iMaxLength);
        },
        myAutoSelectISD: function(sCountryCode) {
            const oISDCombo = this.getFragmentControl("HQD_id_mFM_Id_STDCodeobileNumber");
            if (!oISDCombo) return;

            // Get filtered items
            const aItems = oISDCombo.getItems();
            if (aItems.length === 1) {
                const sCode = aItems[0].getKey();
                oISDCombo.setSelectedKey(sCode);

                const oStuDataModel = this.getView().getModel("stuDataModel");
                oStuDataModel.setProperty("/ISD", sCode);
            }
        },
        myOnStateChange: function(oEvent) {
            const oCombo = oEvent.getSource();
            const sSelectedState = oCombo.getSelectedKey();

            // Reset city when state changes
            const oStuDataModel = this.getView().getModel("stuDataModel");
            oStuDataModel.setProperty("/City", "");

            // Filter cities based on selected state
            if (sSelectedState) {
                this.myFilterCombo("FM_Id_City", "stateName", sSelectedState);
            }
        },
        myOnCityChange: function(oEvent) {
            const oCombo = oEvent.getSource();
            const sSelectedCity = oCombo.getSelectedKey();

            const oStuDataModel = this.getView().getModel("stuDataModel");
            oStuDataModel.setProperty("/City", sSelectedCity);
        },
        myOnISDChange: function(oEvent) {
            const oCombo = oEvent.getSource();
            const sSelectedStdCode = oCombo.getSelectedKey();
            const oCountryModel = this.getView().getModel("CountryModel");
            const aCountries = oCountryModel.getData();

            // Find country matching the selected ISD code
            const oMatch = aCountries.find((c) => c.stdCode === sSelectedStdCode);
            if (oMatch) {
                // Set mobile max length based on country
                this.mySetMobileMaxLength(oMatch.code);
            }
        },
        EOD_onChangeCountry: function(oEvent) {
            this.myOnCountryChange(oEvent);
        },
        FM_onChangeState: function(oEvent) {
            this.myOnStateChange(oEvent);
        },
        FM_onChangeCity: function(oEvent) {
            this.myOnCityChange(oEvent);
        },
        onSTDCodeChange: function(oEvent) {
            this.myOnISDChange(oEvent);
        },
        debugControlsAccess: function() {
            const aControlIds = ["FM_Id_Country", "FM_Id_State", "FM_Id_City", "HQD_id_mFM_Id_STDCodeobileNumber", "FM_Id_MobileNumber"];

            aControlIds.forEach((id) => {
                const oControl = this.getFragmentControl(id);
            });
        },
      _saveFilterState: function () {
    const oDateRange = this.byId("filterCreateDate");

    this.getView().getModel("filterStateModel").setData({
        employeeName: this.byId("filterEmployeeName")?.getValue().trim() || "",
        noticePeriod: this.byId("filterNoticePeriod")?.getValue().trim() || "",
        skills: this.byId("filterSkills")?.getValue().trim() || "",
        experience: this.byId("filterExperience")?.getValue().trim() || "",
        createDateFrom: oDateRange?.getDateValue() || null,
        createDateTo: oDateRange?.getSecondDateValue() || null
    });
},

        AC_ReadCall: async function() {
            this.getBusyDialog();
            try {
                const aSelectFields = ["FullName", "CurrentSalary", "ExpectedSalary", "AvailableForInterview", "NoticePeriod", "Country", "City", "ISD", "Mobile", "Date", "Email", "Experience", "Skills", "Remark", "CreateDate", "CreatedBy", "ID"];
                const oQueryParameters = {
                    fields: aSelectFields.join(","),
                };
                const response = await this.ajaxReadWithJQuery("customReadCall", oQueryParameters);
                const aCandidates = response.data || [];
                this.getOwnerComponent().setModel(new JSONModel(aCandidates), "DataTableModel");
                const nameSet = new Set(aCandidates.map((c) => c.FullName).filter(Boolean));
                this.getView().setModel(
                    new sap.ui.model.json.JSONModel(
                        Array.from(nameSet).map((name) => ({
                            FullName: name,
                        }))
                    ),
                    "UniqueNamesModel"
                );
            } catch (err) {
                sap.m.MessageToast.show("Failed to load candidate data.");
            } finally {
                this.closeBusyDialog();
            }
        },
        onPressback: function() {
            this.getOwnerComponent().getRouter().navTo("RouteTilePage");
        },
        onLogout: function() {
            this.CommonLogoutFunction();
        },
        onCandidatePress: function(oEvent) {
             this._saveFilterState();
            const id = oEvent.getSource().getBindingContext("DataTableModel").getObject().ID;
           
            this.getOwnerComponent().getRouter().navTo("AppliedCanDetail", {
                id: id,
            });
        },
        onFilterBarClear: function() {
            this.byId("filterEmployeeName").setSelectedKey("");
            this.byId("filterNoticePeriod").setValue("");
            this.byId("filterSkills").setValue("");
            this.byId("filterExperience").setSelectedKey("");
            this.byId("filterCreateDate").setValue("");
        },
       onFilterBarSearch: function () {
    this._saveFilterState();
    this.getBusyDialog();

    setTimeout(() => {
        try {
            const oTableBinding = this.byId("appliedCandidatesTable").getBinding("items");
            const aFilters = [];
            const oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
                pattern: "yyyy-MM-dd"
            });

            const sName = this.byId("filterEmployeeName").getValue().trim();
            if (sName) {
                aFilters.push(new sap.ui.model.Filter("FullName", sap.ui.model.FilterOperator.Contains, sName));
            }

            const sNoticePeriodInput = this.byId("filterNoticePeriod").getValue().trim();
            if (sNoticePeriodInput) {
                aFilters.push(new sap.ui.model.Filter({
                    path: "NoticePeriod",
                    test: function (sDataValue) {
                        if (!sDataValue || !sNoticePeriodInput) return false;
                        const data = sDataValue.toString().trim();
                        const input = sNoticePeriodInput.toString().trim();

                        if (!input.includes("-")) {
                            return data.toLowerCase() === input.toLowerCase();
                        } else {
                            if (data.toLowerCase() === input.toLowerCase()) {
                                return true;
                            }
                            if (!data.includes("-")) {
                                const numData = parseInt(data, 10);
                                const rangeParts = input.split("-");
                                const min = parseInt(rangeParts[0].trim(), 10);
                                const max = parseInt(rangeParts[1].trim(), 10);

                                if (isNaN(numData) || isNaN(min) || isNaN(max)) return false;
                                return numData >= min && numData <= max;
                            }
                            return false;
                        }
                    }
                }));
            }

            const sSkills = this.byId("filterSkills").getValue().trim();
            if (sSkills) {
                aFilters.push(new sap.ui.model.Filter("Skills", sap.ui.model.FilterOperator.Contains, sSkills));
            }

           const sExperienceInput = this.byId("filterExperience").getValue().trim();

if (sExperienceInput) {
    aFilters.push(new sap.ui.model.Filter({
        path: "Experience",
        test: function (sDataValue) {
            const input = (sExperienceInput || "").toString().trim().toLowerCase();
            const data = (sDataValue ?? "").toString().trim().toLowerCase();

            // Handle Fresher
            if (input === "fresher") {
                return data === "0" || data === "fresher";
            }

            // Handle exact match for normal values like 1, 2, 3
            if (!input.includes("-")) {
                return data === input;
            }

            // Handle range like 1-3
            const rangeParts = input.split("-");
            const min = parseFloat(rangeParts[0].trim());
            const max = parseFloat(rangeParts[1].trim());

            if (isNaN(min) || isNaN(max)) {
                return false;
            }

            const normalizedData = data === "fresher" ? "0" : data;
            const numData = parseFloat(normalizedData);

            if (isNaN(numData)) {
                return false;
            }

            return numData >= min && numData <= max;
        }
    }));
}

            const oDateRange = this.byId("filterCreateDate");
            const oStartDate = oDateRange?.getDateValue();
            const oEndDate = oDateRange?.getSecondDateValue();

            if (oStartDate && oEndDate) {
                const sStart = oDateFormat.format(oStartDate);
                const sEnd = oDateFormat.format(oEndDate);
                aFilters.push(new sap.ui.model.Filter("CreateDate", sap.ui.model.FilterOperator.BT, sStart, sEnd));
            }

            oTableBinding.filter(aFilters);
            this.getView().getModel("viewModel").setProperty("/filteredCount", oTableBinding.getLength());
        } catch (error) {
            sap.m.MessageToast.show("Error during filtering.");
        } finally {
            setTimeout(() => this.closeBusyDialog(), 300);
        }
    }, 50);
},
        onSuggestSkills: function(oEvent) {
            let sValue = oEvent.getParameter("suggestValue")?.toLowerCase() || "";
            let aTableData = this.getView().getModel("DataTableModel").getData();
            let aMatchingSkillStrings = aTableData
                .map((item) => item.Skills?.trim())
                .filter((skillStr) => {
                    if (!skillStr) return false;
                    return skillStr.split(",").some((skill) => skill.trim().toLowerCase().includes(sValue));
                });
            let aUniqueSkillStrings = [...new Set(aMatchingSkillStrings)];
            let aSuggestionItems = aUniqueSkillStrings.map((skill) => ({
                skill,
            }));
            this.getView().setModel(
                new JSONModel({
                    skills: aSuggestionItems,
                }),
                "skillModel"
            );
        },
        onAddNewCandidate: function() {
             const oToday = new Date();
    const sFormattedDate = `${oToday.getFullYear()}-${String(oToday.getMonth() + 1).padStart(2, "0")}-${String(oToday.getDate()).padStart(2, "0")}`;
            const oNewCandidate = {
                FullName: "",
                ExpectedSalary: "",
                CurrentSalary: "",
                AvailableForInterview: "",
                NoticePeriod: "",
                Mobile: "",
                Date: sFormattedDate,
                State: "",
                Email: "",
                Experience: "",
                Remark: "",
                Skills: "",
                ISD: "",
                City: "",
                Country: "",
                CreateDate: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`,
            };
            this.getView().setModel(new JSONModel(oNewCandidate), "stuDataModel");
            this._openDialog("Create Candidate", true);
            this.getView().getModel("EditableModeltruefalse").setProperty("/Editable", true);
        },
        onEditCandidate: function() {
            const oTable = this.byId("appliedCandidatesTable");
            const oSelectedItem = oTable.getSelectedItem();
            if (!oSelectedItem) {
                MessageToast.show(this.i18na.getText("MessageNoRowSelected"));
                return;
            }
            const oContext = oSelectedItem.getBindingContext("DataTableModel");
            const oCandidateData = jQuery.extend({}, oContext.getObject());
            // Normalize fields
            if (oCandidateData.Date === "1899-11-30T00:00:00.000Z") oCandidateData.Date = null;
            if (oCandidateData.NoticePeriod === "0") oCandidateData.NoticePeriod = "Immediate";
            this.getView().setModel(new JSONModel(oCandidateData), "stuDataModel");
            this._openDialog("Edit Candidate", false);
            this.getView().getModel("EditableModeltruefalse").setProperty("/Editable", false);
        },
        onDeleteCandidate: function() {
            const oTable = this.byId("appliedCandidatesTable");
            const oSelectedItem = oTable.getSelectedItem();
            if (!oSelectedItem) {
                MessageToast.show(this.i18na.getText("MessageNoRowSelected"));
                return;
            }
            const sID = oSelectedItem.getBindingContext("DataTableModel").getObject().ID;
            this.showConfirmationDialog(this.i18na.getText("confirmTitle"), this.i18na.getText("ConfirmRecruitmentDeleteMessage"), async () => {
                this.getBusyDialog();
                try {
                    await this.ajaxDeleteWithJQuery("JobApplications", {
                        filters: {
                            ID: sID,
                        },
                    });
                    MessageToast.show(this.i18na.getText("dataDelteSucces"));
                    this.AC_ReadCall(); // Refresh the table
                } catch (error) {
                    MessageToast.show("Delete failed.");
                } finally {
                    this.closeBusyDialog();
                    oTable.removeSelections();
                }
            });
        },
        _preparePayload: function() {
            if (!this._validateAllDialogFields()) {
                return null;
            }

            const oStuDataModel = this.getView().getModel("stuDataModel");
            const oData = oStuDataModel.getData();

            // Get values from controls
            const oCountryCombo = this.getFragmentControl("FM_Id_Country");
            const oStateCombo = this.getFragmentControl("FM_Id_State");
            const oCityCombo = this.getFragmentControl("FM_Id_City");
            const oISDCombo = this.getFragmentControl("HQD_id_mFM_Id_STDCodeobileNumber");
            const oMobileInput = this.getFragmentControl("FM_Id_MobileNumber");
            const oCurrentCTC = this.getFragmentControl("FM_RE_CurrentCTC");
            const oExpectedCTC = this.getFragmentControl("FM_RE_ExpectedCTC");
            const oExperience = this.getFragmentControl("FM_Id_Experience");

            // Create payload - REMOVE FullMobileNumber field
            const oPayload = {
                FullName: oData.FullName || "",
                CurrentSalary: parseFloat(oCurrentCTC.getValue()) || 0,
                ExpectedSalary: parseFloat(oExpectedCTC.getValue()) || 0,
                AvailableForInterview: oData.AvailableForInterview || "",
                NoticePeriod: this.getFragmentControl("FM_RE_NoticePeriod").getValue().trim(),
                Country: oCountryCombo.getSelectedKey() || "",
                State: oStateCombo.getSelectedKey() || "",
                City: oCityCombo.getSelectedKey() || "",
                ISD: oISDCombo.getSelectedKey() || "", // Keep as ISD (matches successful payload)
                Mobile: oMobileInput.getValue().trim() || "",
                CreateDate: oData.Date || "",
                Email: oData.Email || "",
                Experience: parseFloat(oExperience.getValue()) || 0,
                Skills: oData.Skills || "",
                Remark: oData.Remark || "",
            };

            // Handle notice period conversion
            if (oPayload.NoticePeriod && oPayload.NoticePeriod.toLowerCase() === "immediate") {
                oPayload.NoticePeriod = "0";
            }

            // Handle date format
            if (oPayload.Date) {
                oPayload.Date = oPayload.Date.split(".").reverse().join("/");
            }

            // Add created by info for new records
            if (!oData.ID) {
                const sUserName = this.getOwnerComponent().getModel("LoginModel").getProperty("/EmployeeName");
                const sUserID = this.getOwnerComponent().getModel("LoginModel").getProperty("/EmployeeID");
                oPayload.CreatedBy = `${sUserName} (${sUserID})`;
            } else {
                oPayload.ID = oData.ID;
            }

            Object.keys(oPayload).forEach((key) => {});

            return oPayload;
        },
        myValidateMobile: function(oEventOrControl) {
            let oInput;

            // Handle both event object and direct control reference
            if (oEventOrControl && typeof oEventOrControl.getSource === "function") {
                oInput = oEventOrControl.getSource();
            } else {
                oInput = oEventOrControl;
            }

            if (!oInput) {
                return false;
            }

            const sValue = (oInput.getValue() || "").trim();
            const iMaxLength = oInput.getMaxLength();

            oInput.setValueState(sap.ui.core.ValueState.None);
            oInput.setValueStateText("");

            if (!sValue) {
                return true; // Empty is okay during live validation, will be caught in final validation
            }

            if (sValue.startsWith("0")) {
                oInput.setValueState(sap.ui.core.ValueState.Error);
                oInput.setValueStateText("Mobile number cannot begin with 0");
                return false;
            }

            if (!/^\d+$/.test(sValue)) {
                oInput.setValueState(sap.ui.core.ValueState.Error);
                oInput.setValueStateText("Only digits are allowed");
                return false;
            }

            if (iMaxLength === 10 && sValue.length !== 10) {
                oInput.setValueState(sap.ui.core.ValueState.Error);
                oInput.setValueStateText("Mobile number must be exactly 10 digits");
                return false;
            }

            if (iMaxLength === 20 && (sValue.length < 4 || sValue.length > 20)) {
                oInput.setValueState(sap.ui.core.ValueState.Error);
                oInput.setValueStateText("Mobile number must be between 4 and 20 digits long");
                return false;
            }

            return true;
        },
        onValidateMobile: function(oEvent) {
            // This will handle live validation during input
            this.myValidateMobile(oEvent);
        },
        onAfterDialogOpen: function() {
            // Initialize with empty filters for state and city
            const oStateCombo = this.getFragmentControl("FM_Id_State");
            if (oStateCombo) {
                oStateCombo.getBinding("items").filter([]);
            }

            const oCityCombo = this.getFragmentControl("FM_Id_City");
            if (oCityCombo) {
                oCityCombo.getBinding("items").filter([]);
            }

            // Initialize ISD combo with all countries
            const oISDCombo = this.getFragmentControl("HQD_id_mFM_Id_STDCodeobileNumber");
            if (oISDCombo) {
                oISDCombo.getBinding("items").filter([]);
            }

            // Set default mobile max length
            this.mySetMobileMaxLength(""); // Default to international format

            // Reset validation states
            this._resetValidationStates();
        },
        _resetValidationStates: function() {
            const aControls = ["FM_Id_Country", "FM_Id_State", "FM_Id_City", "HQD_id_mFM_Id_STDCodeobileNumber", "FM_Id_MobileNumber"];

            aControls.forEach((controlId) => {
                const oControl = this.getFragmentControl(controlId);
                if (oControl) {
                    oControl.setValueState(sap.ui.core.ValueState.None);
                    oControl.setValueStateText("");
                }
            });
        },
        onSaveNewCandidate: async function() {
            const oPayload = this._preparePayload();
            if (!oPayload) return;
            this.getBusyDialog();
            try {
                await this.ajaxCreateWithJQuery("JobApplications", {
                    data: oPayload,
                });
                MessageToast.show(this.i18na.getText("messageTraineeCreated"));
                this.AC_ReadCall(); // Refresh data
                this._closeDialog();
            } catch (err) {
                MessageToast.show(err.message || err.responseText);
            } finally {
                this.closeBusyDialog();
            }
        },
        onUpdateCandidate: async function() {
            const oPayload = this._preparePayload();
            if (!oPayload) return;
            this.getBusyDialog();
            try {
                await this.ajaxUpdateWithJQuery("JobApplications", {
                    data: oPayload,
                    filters: {
                        ID: oPayload.ID,
                    },
                });
                MessageToast.show(this.i18na.getText("dataUpdatedSuccess"));
                this.AC_ReadCall(); // Refresh data
                this._closeDialog();
            } catch (error) {
                MessageToast.show("Update failed.");
            } finally {
                this.closeBusyDialog();
            }
        },
        _openDialog: function(sTitle, bIsCreate) {
            if (!this.oDialog) {
                this.oDialog = sap.ui.core.Fragment.load({
                    name: "sap.kt.com.minihrsolution.fragment.AddRecruitment",
                    controller: this,
                }).then((oDialog) => {
                    this.getView().addDependent(oDialog);
                    return oDialog;
                });
            }
            this.oDialog.then((oDialog) => {
                oDialog.setTitle(sTitle);
                sap.ui.getCore().byId("FM_Id_SubmitBTN").setVisible(bIsCreate);
                sap.ui.getCore().byId("FM_Id_EditBTN").setVisible(!bIsCreate);
                if (!bIsCreate) {
                    sap.ui.getCore().byId("FM_Id_EditBTN").setText("Edit").setType("Transparent");
                }
                oDialog.open();
            });
        },
        _closeDialog: function() {
            if (this.oDialog) {
                this.oDialog.then((oDialog) => oDialog.close());
            }
            sap.ui.getCore().byId("FM_RE_Name").setValueState("None");
            sap.ui.getCore().byId("FM_RE_CurrentCTC").setValueState("None");
            sap.ui.getCore().byId("FM_RE_ExpectedCTC").setValueState("None");
            sap.ui.getCore().byId("FM_RE_AvlInterview").setValueState("None");
            sap.ui.getCore().byId("FM_RE_NoticePeriod").setValueState("None");
            sap.ui.getCore().byId("FM_Id_MobileNumber").setValueState("None");
            sap.ui.getCore().byId("FM_Id_DateAvlForInterview").setValueState("None");
            sap.ui.getCore().byId("FM_Id_Email").setValueState("None");
            sap.ui.getCore().byId("FM_Id_Experience").setValueState("None");
            sap.ui.getCore().byId("FM_Id_Skills").setValueState("None");
            sap.ui.getCore().byId("FM_Id_City").setValueState("None");
            this.getView().byId("appliedCandidatesTable").removeSelections();
        },
        onDialogEditToggle: function() {
            const oEditButton = sap.ui.getCore().byId("FM_Id_EditBTN");
            if (oEditButton.getText() === "Edit") {
                this.getView().getModel("EditableModeltruefalse").setProperty("/Editable", true);
                oEditButton.setText("Save").setType("Transparent");
            } else {
                this.onUpdateCandidate();
            }
        },
        onDialogCountryChange: function(oEvent) {
            const sCountryCode = oEvent.getSource().getSelectedKey();
            const oCityComboBox = sap.ui.getCore().byId("FM_Id_City");
            oCityComboBox.getBinding("items").filter(new Filter("CountryCode", sap.ui.model.FilterOperator.EQ, sCountryCode));
            this.getView().getModel("stuDataModel").setProperty("/City", "");
        },
        _validateAllDialogFields: function() {
            try {
                // Use getFragmentControl instead of sap.ui.getCore().byId for fragment controls
                const isValid =
                    utils._LCvalidateName(this.getFragmentControl("FM_RE_Name"), "ID") &&
                    utils._LCvalidateAmount(this.getFragmentControl("FM_RE_CurrentCTC"), "ID") &&
                    utils._LCvalidateMandatoryField(this.getFragmentControl("FM_RE_ExpectedCTC"), "ID") &&
                    utils._LCvalidateMandatoryField(this.getFragmentControl("FM_RE_NoticePeriod"), "ID") &&
                    // Country, State, City validation
                    this._validateCountry() &&
                    this._validateState() &&
                    this._validateCity() &&
                    // Mobile number validation (using our custom validation)
                    this._validateMobileNumber() &&
                    utils._LCvalidateEmail(this.getFragmentControl("FM_Id_Email"), "ID") &&
                    utils._LCvalidateMandatoryField(this.getFragmentControl("FM_Id_Experience"), "ID") &&
                    utils._LCvalidateMandatoryField(this.getFragmentControl("FM_Id_Skills"), "ID");
                if (!isValid) {
                    MessageToast.show(this.i18na.getText("mandetoryFields"));
                }
                return isValid;
            } catch (error) {
                MessageToast.show("An error occurred during validation.");
                return false;
            }
        },
        _validateCountry: function() {
            const oCountryCombo = this.getFragmentControl("FM_Id_Country");
            const sCountry = oCountryCombo.getSelectedKey();

            if (!sCountry) {
                oCountryCombo.setValueState(sap.ui.core.ValueState.Error);
                oCountryCombo.setValueStateText("Please select a country");
                return false;
            }

            oCountryCombo.setValueState(sap.ui.core.ValueState.None);
            return true;
        },
        _validateState: function() {
            const oStateCombo = this.getFragmentControl("FM_Id_State");
            const sState = oStateCombo.getSelectedKey();

            if (!sState) {
                oStateCombo.setValueState(sap.ui.core.ValueState.Error);
                oStateCombo.setValueStateText("Please select a state");
                return false;
            }

            oStateCombo.setValueState(sap.ui.core.ValueState.None);
            return true;
        },
        _validateCity: function() {
            const oCityCombo = this.getFragmentControl("FM_Id_City");
            const sCity = oCityCombo.getSelectedKey();

            if (!sCity) {
                oCityCombo.setValueState(sap.ui.core.ValueState.Error);
                oCityCombo.setValueStateText("Please select a city");
                return false;
            }

            oCityCombo.setValueState(sap.ui.core.ValueState.None);
            return true;
        },
        _validateMobileNumber: function() {
            const oMobileInput = this.getFragmentControl("FM_Id_MobileNumber");
            const sMobile = oMobileInput.getValue().trim();
            const oISDCombo = this.getFragmentControl("HQD_id_mFM_Id_STDCodeobileNumber");
            const sISD = oISDCombo.getSelectedKey();

            // Validate ISD code
            if (!sISD) {
                oISDCombo.setValueState(sap.ui.core.ValueState.Error);
                oISDCombo.setValueStateText("Please select country code");
                return false;
            }
            oISDCombo.setValueState(sap.ui.core.ValueState.None);

            // Validate mobile number
            if (!sMobile) {
                oMobileInput.setValueState(sap.ui.core.ValueState.Error);
                oMobileInput.setValueStateText("Please enter mobile number");
                return false;
            }

            // Use our custom mobile validation
            return this.myValidateMobile({
                getSource: () => oMobileInput
            });
        },
        onValidateName: (oEvent) => utils._LCvalidateName(oEvent),
        onValidateCTC: (oEvent) => utils._LCvalidateMandatoryField(oEvent),
        onValidateEmail: (oEvent) => utils._LCvalidateEmail(oEvent),
        onValidateMandatoryField: (oEvent) => utils._LCvalidateMandatoryField(oEvent),
        onDropdownChange: (oEvent) => utils._LCstrictValidationComboBox(oEvent),
        onExport: function() {
            const aData = this.getView().getModel("DataTableModel").getData();
            const aFormattedData = aData.map((item) => {
                return {
                    ...item,
                    CurrentSalary: formatter.LPAattach(item.CurrentSalary),
                    ExpectedSalary: formatter.LPAattach(item.ExpectedSalary),
                    Experience: formatter.ExperienceFormat(item.Experience),
                };
            });
            const aCols = [{
                    label: "Name",
                    property: "FullName",
                    type: "string",
                },
                {
                    label: "Current CTC (LPA)",
                    property: "CurrentSalary",
                    type: "string",
                },
                {
                    label: "Expected CTC (LPA)",
                    property: "ExpectedSalary",
                    type: "string",
                },
                {
                    label: "Notice Period (Days)",
                    property: "NoticePeriod",
                    type: "string",
                },
                {
                    label: "Mobile Number",
                    property: "Mobile",
                    type: "string",
                },
                {
                    label: "Email",
                    property: "Email",
                    type: "string",
                },
                {
                    label: "Notice Period (Days)",
                    property: "NoticePeriod",
                    type: "string",
                },
                {
                    label: "Experience (Years)",
                    property: "Experience",
                    type: "string",
                },
                {
                    label: "Skills",
                    property: "Skills",
                    type: "string",
                },
                {
                    label: "Email ID",
                    property: "Email",
                    type: "string",
                },
            ];
            const oSettings = {
                workbook: {
                    columns: aCols,
                    context: {
                        sheetName: this.i18nModel.getText("candidateData"),
                      },
                },
                dataSource: aFormattedData,
                fileName: "Candidate_Details.xlsx",
            };
            const oSheet = new sap.ui.export.Spreadsheet(oSettings);
            oSheet.build().finally(() => oSheet.destroy());
        },
        SalaryInfoPress: function(oEvent) {
            if (!this._oPopover) {
                this._oPopover = new sap.m.Popover({
                    contentWidth: "300px",
                    contentHeight: "auto",
                    showHeader: false,
                    placement: sap.m.PlacementType.Bottom,
                    content: [
                        new sap.m.VBox({
                            alignItems: "Center",
                            justifyContent: "Center",
                            width: "100%",
                            items: [
                                new sap.m.Text({
                                    text: this.i18na.getText("salaryPackageInfo"),
                                    wrapping: true,
                                }),
                            ],
                        }).addStyleClass("customPopoverContent"),
                    ],
                });
                this.getView().addDependent(this._oPopover);
            }
            this._oPopover.openBy(oEvent.getSource());
        },
    });
});