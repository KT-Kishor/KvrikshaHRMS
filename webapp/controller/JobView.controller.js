sap.ui.define(["./BaseController", "sap/ui/model/json/JSONModel", "../utils/validation", "sap/m/MessageToast", "sap/ui/core/Fragment", "sap/m/MessageBox"], (BaseController, JSONModel, utils, MessageToast, Fragment, MessageBox) => {
    ("use strict");
    return BaseController.extend("sap.kt.com.minihrsolution.controller.JobView", {
        onInit: function() {
            this.getView().addStyleClass("sapUiSizeCompact");

            // Attach route match handler
            this.getOwnerComponent().getRouter().getRoute("RouteJobView").attachPatternMatched(this._onRouteMatched, this);

            // Load i18n bundle
            const oI18nModel = this.getOwnerComponent().getModel("i18n");
            this.oResourceBundle = oI18nModel.getResourceBundle();

            // Init cities model
            this.getView().setModel(new JSONModel({
                cities: []
            }), "cities");

            // Init token model for file uploads
            this.tokenModel = new JSONModel({
                tokens: []
            });
            this.getView().setModel(this.tokenModel, "tokenModel");

            this.getView().setModel(this.oFileModel);

            setTimeout(() => {
                const fileInput = document.getElementById("hiddenFileInput");
                if (fileInput) {
                    fileInput.addEventListener("change", this.onFilesSelected.bind(this));
                }
            }, 0);
        },

        _onRouteMatched: function(oEvent) {
            const sJobId = oEvent.getParameter("arguments").jobId;

            this.getBusyDialog();
            this.getView().byId("jobDetailsContainer").setVisible(false);
            this.getView().byId("idJobNotAvailable").setVisible(false);

            this._fetchJobById(sJobId)
                .then((oJob) => {
                    const bIsValidJob = !!oJob;
                    const oJobApplicationModel = new JSONModel({
                        ...oJob,
                        isValidJob: bIsValidJob,
                    });

                    this.getView().setModel(oJobApplicationModel, "JobApplicationModel");
                    if (bIsValidJob) {
                        this.getView().byId("jobDetailsContainer").setVisible(true);
                    } else {
                        this.getView().byId("idJobNotAvailable").setVisible(true);
                    }
                })
                .catch((err) => {
                    // MessageToast.show("Failed to fetch job details");
                })
                .finally(() => {
                    this.closeBusyDialog();
                });
        },

        _fetchJobById: function(sJobId) {
            const sUrl = "https://rest.kalpavrikshatechnologies.com/JobOpenings";

            return new Promise((resolve, reject) => {
                $.ajax({
                    url: sUrl,
                    method: "GET",
                    contentType: "application/json",
                    dataType: "json",
                    headers: {
                        name: "$2a$12$LC.eHGIEwcbEWhpi9gEA.umh8Psgnlva2aGfFlZLuMtPFjrMDwSui",
                        password: "$2a$12$By8zKifvRcfxTbabZJ5ssOsheOLdAxA2p6/pdaNvv1xy1aHucPm0u",
                    },
                    success: function(oData) {
                        const aData = oData?.data || [];

                        const oFilteredJob = aData.find((job) => {
                            const idMatch = job?.ID === sJobId;
                            const statusTrue = job?.Status === "true";

                            if (idMatch && statusTrue) {
                                return true;
                            }
                            return false;
                        });

                        if (oFilteredJob) {
                            resolve(oFilteredJob);
                        } else {
                            resolve(null);
                        }
                    },
                    error: function(xhr, status, error) {
                        reject(error);
                    },
                });
            });
        },

        onFileChange: function(oEvent) {
            const oFile = oEvent.getParameter("files")[0];
            if (!oFile) {
                MessageToast.show("No file selected");
                return;
            }
            const oModel = this.getView().getModel("tokenModel");
            let aTokens = oModel.getProperty("/tokens") || [];

            if (aTokens.length >= 1) {
                sap.m.MessageBox.error("Only one file uploaded");
                return;
            }

            const reader = new FileReader();
            const that = this;

            reader.onload = function(e) {
                const base64 = e.target.result.split(",")[1];
                const oUploadModel = that.getView().getModel("UploadModel");
                if (!oUploadModel) {
                    that.getView().setModel(new sap.ui.model.json.JSONModel(), "UploadModel");
                }
                that.getView().getModel("UploadModel").setData({
                    File: base64,
                    FileName: oFile.name,
                    FileType: oFile.type,
                });
                aTokens.push({
                    key: oFile.name,
                    text: oFile.name,
                });
                oModel.setProperty("/tokens", aTokens);

                const fileErrorLayout = sap.ui.core.Fragment.byId("jobFormFrag", "fileErrorLayout");

                const fileErrorText = sap.ui.core.Fragment.byId("jobFormFrag", "fileErrorText");
                fileErrorText.setText("");
                fileErrorText.setVisible(false);
                fileErrorLayout.setVisible(false);

                MessageToast.show("File uploaded successfully: " + oFile.name);
            };

            reader.readAsDataURL(oFile);
        },

        onTokenDelete: function(oEvent) {
            var oModel = this.getView().getModel("tokenModel");
            var aTokens = oModel.getProperty("/tokens") || [];

            var aTokensToDelete = oEvent.getParameter("tokens");

            aTokensToDelete.forEach(function(oDeletedToken) {
                var sKey = oDeletedToken.getKey();
                aTokens = aTokens.filter(function(token) {
                    return token.key !== sKey;
                });
            });

            oModel.setProperty("/tokens", aTokens);

            if (aTokens.length === 0) {
                const uploadModel = this.getView().getModel("UploadModel");
                if (uploadModel) {
                    uploadModel.setData({
                        File: "",
                        FileName: "",
                        FileType: "",
                    });
                }

                const fileErrorText = sap.ui.core.Fragment.byId("jobFormFrag", "fileErrorText");
                const fileErrorLayout = sap.ui.core.Fragment.byId("jobFormFrag", "fileErrorLayout");

                if (fileErrorText) {
                    fileErrorText.setText("Please upload your resume");
                    fileErrorText.setVisible(true);
                    fileErrorLayout.setVisible(true);
                }

                this.oSelectedFile = null;
            }
        },

        onFileSizeExceeds: function(oEvent) {
            const fileErrorText = sap.ui.core.Fragment.byId("jobFormFrag", "fileErrorText");
            const fileErrorLayout = sap.ui.core.Fragment.byId("jobFormFrag", "fileErrorLayout");
            fileErrorLayout.setVisible(true);
            fileErrorText.setVisible(true);
            fileErrorText.setText("File size must be under 5MB");

            const fileUploader = oEvent.getSource();

            loader.setValueStateText("File too large");

            //  Clear fileUploader input
            fileUploader.setValue("");

            //  Clear UploadModel
            const uploadModel = this.getView().getModel("UploadModel");
            if (uploadModel) {
                uploadModel.setData({
                    File: "",
                    FileName: "",
                    FileType: "",
                });
            }

            //  Clear Tokenizer model
            const tokenizer = sap.ui.core.Fragment.byId("jobFormFrag", "id_tokenizer");
            const tokenModel = tokenizer.getModel("tokenModel");
            if (tokenModel) {
                tokenModel.setProperty("/tokens", []);
            }

            //  Clear stored file
            this.oSelectedFile = null;
        },

        onNavBack: function() {
            const oAppStateModel = this.getOwnerComponent().getModel("AppStateModel");
            const sTabKey = oAppStateModel?.getProperty("/previousTab") || "idHome";

            this.getOwnerComponent().getRouter().navTo("Job_Details");

            sessionStorage.setItem("homePageReturnTab", sTabKey);
        },

        anySkillPresent: function(primary, secondary, required) {
            return (primary && primary.trim().length > 0) || (secondary && secondary.trim().length > 0) || (required && required.trim().length > 0);
        },

        hasValue: function(val) {
            if (val === null || val === undefined) {
                return false;
            }

            if (typeof val === "string") {
                return val.trim().length > 0;
            }

            if (typeof val === "number") {
                return val !== 0;
            }

            return !!val;
        },
        getWorkModeTooltip: function(sMode) {
            switch ((sMode || "").toUpperCase()) {
                case "REMOTE":
                    return "Work from home";
                case "ON-SITE":
                    return "Work from office";
                case "HYBRID":
                    return "Combination of remote and on-site work";
                default:
                    return "Work mode information not available";
            }
        },
        formatWorkModeLabel: function(sValue) {
            if (!sValue) return "";

            switch (sValue.toUpperCase()) {
                case "HYBRID":
                    return "Hybrid";
                case "REMOTE":
                    return "Remote";
                case "ON-SITE":
                    return "On-Site";
                default:
                    return sValue;
            }
        },
        _cleanFormattedTextStyles: function() {
            const els = document.querySelectorAll(".myFormattedText span, .myFormattedText li, .myFormattedText strong, .myFormattedText .highlight, .myFormattedText p");
            els.forEach((el) => {
                el.removeAttribute("style");
                el.style.fontSize = "20px";
                el.style.lineHeight = "1.5";
                el.style.marginBottom = "1em";
                el.style.fontWeight = "bold";
                el.style.color = "#2c3e50";
            });
        },
        getFormDataAsJSON: function() {
            const safeVal = (ctrl) => ctrl?.getValue?.().trim?.() || "";
            const safeKey = (ctrl) => ctrl?.getSelectedKey?.().trim?.() || "";
            const safeText = (ctrl) => ctrl?.getValue?.().trim?.() || ctrl?.getSelectedItem?.()?.getText?.().trim?.() || "";

            const safeDate = (date) => (date instanceof Date ? date.toISOString().split("T")[0] : "");
            const f = (id) => sap.ui.core.Fragment.byId("jobFormFrag", id);
            const view = this.getView();

            //  Personal Details
            const fullName = safeVal(f("fullNameInput"));
            const gender = safeKey(f("genderCombo")) || safeText(f("genderCombo"));
            const mobile = safeVal(f("mobileInput"));
            const email = safeVal(f("emailInput"));
            const address = safeVal(f("addressInput"));
            const dob = safeDate(f("dobPicker")?.getDateValue?.());

            //  Education
            const university = safeText(f("universityCombo")) || safeVal(f("universityCombo"));
            const passingYear = safeVal(f("PassingYear"));
            const skills = safeVal(f("skillsInput"));
            const qualification = safeText(f("qualificationCombo")) || safeVal(f("qualificationCombo"));

            const experience = safeVal(f("experienceInput"));
            const company = safeVal(f("companyInput"));
            const designation = safeText(f("previousJobTitleCombo")) || "";
            const salary = safeVal(f("salaryInput"));

            const workDurationStart = safeDate(f("experienceRange")?.getDateValue?.());
            const workDurationEnd = safeDate(f("experienceRange")?.getSecondDateValue?.());
            const employmentType = safeText(f("employmentTypeCombo")) || safeKey(f("employmentTypeCombo"));
            const noticePeriod = safeText(f("noticePeriodCombo")) || safeVal(f("noticePeriodCombo"));
            const expectedSalary = safeVal(f("expectedSalaryInput"));
            const describeYourSelf = safeVal(f("fresherSelfDesc"));
            const expertise = safeText(f("fresherExpertiseInput"));

            const roles = safeVal(f("rolesInput"));

            const country = safeText(f("countryCombo")) || safeVal(f("countryCombo"));
            const isd = safeText(f("isd_code")) || safeVal(f("isd_code"));
            const city = f("LocationComboBox").getSelectedKey();

            // Resume
            const uploadModel = view.getModel("UploadModel")?.getData?.() || {};
            const fileBase64 = uploadModel.File || "";
            const fileName = uploadModel.FileName || "";
            const fileType = uploadModel.FileType || "";

            const jobTitle = this.getView().getModel("JobApplicationModel")?.getProperty("/JobTitle") || "Unknown";

            //  Final Payload
            return {
                FullName: fullName,
                Gender: gender,
                Mobile: mobile,
                Email: email,
                Address: address,
                DOB: dob,

                University: university,
                PassingYear: passingYear,
                Skills: skills,
                HighestQualifaction: qualification,

                Experience: experience,
                CurrentCompany: company,
                Designation: designation,
                // PreviousRoles: previousRoles,
                CurrentSalary: salary,
                WorkDurationStart: workDurationStart,
                WorkDurationEnd: workDurationEnd,
                Roles: roles,

                EmploymentType: employmentType,
                NoticePeriod: noticePeriod,
                ExpectedSalary: expectedSalary,

                ExpertiseIn: expertise,
                DescribeYourSelf: describeYourSelf,

                ISD: isd,
                Country: country,
                City: city,
                State: sap.ui.core.Fragment.byId("jobFormFrag", "stateCombo").getSelectedKey(),
                JobTitle: jobTitle,
                ResumeFile: fileBase64,
                CreatedBy: "Candidate",
                AttachmentName: fileName,
                AttachmentType: fileType,
                CreateDate: new Date().toISOString().split("T")[0],
            };
        },

        _cleanUnsupportedTags: function(html) {
            return html.replace(/<mark>/gi, '<span class="highlight">').replace(/<\/mark>/gi, "</span>");
        },

        onApply: function() {
            const that = this;

            // Create and attach JobModel
            const oJobData = {
                fullName: "",
                email: "",
                mobile: "",
                country: "",
                stdCode: "",
                city: "",
                dob: null,
                passingYear: null,
                experienceRange: {
                    start: null,
                    end: null,
                },
                resume: "",
                qualification: "",
                university: "",
                noticePeriod: "",
                previousDesignation: "",
                Roles: "",
                ExpertiseIn: "",
            };

            const oJobModel = new sap.ui.model.json.JSONModel(oJobData);
            this.getView().setModel(oJobModel, "JobModel");

            if (!this._oJobDialog) {
                Fragment.load({
                    id: "jobFormFrag",
                    name: "sap.kt.com.minihrsolution.fragment.JobApplication",
                    controller: this,
                }).then(function(oDialog) {
                    that._oJobDialog = oDialog; //  Save the actual Dialog after loading
                    that.getView().addDependent(oDialog);
                    oDialog.setModel(oJobModel, "JobApplicationModel");

                    const oJobApplicationModelFromView = that.getView().getModel("JobApplicationModel");
const oExperienceSection = Fragment.byId("jobFormFrag", "experienceSection");
const oFresherSection = Fragment.byId("jobFormFrag", "fresherSection");

const nExp =oJobApplicationModelFromView.getProperty("/Experience") || 0;

oExperienceSection.setVisible(nExp > "0");
oFresherSection.setVisible(nExp <= "0");

                    if (oJobApplicationModelFromView) {
                        oDialog.setModel(oJobApplicationModelFromView, "JobApplicationModel");

                        const jobTitle = oJobApplicationModelFromView.getProperty("/JobTitle");
                        if (jobTitle) {
                            oDialog.setTitle("Job Application — " + jobTitle);
                        } else {
                            oDialog.setTitle("Job Application");
                        }
                    } else {
                        const oFallbackJobModel = new sap.ui.model.json.JSONModel({
                            JobTitle: "Job Application", // Default title if not found
                        });
                        oDialog.setModel(oFallbackJobModel, "JobApplicationModel");
                        oDialog.setTitle("Job Application"); // Set fallback title
                    }

                    ["CountryModel", "CityModel"].forEach((sName) => {
                        const oGlobalModel = that.getOwnerComponent().getModel(sName);
                        if (oGlobalModel) {
                            oDialog.setModel(oGlobalModel, sName);
                        }
                    });
                    //  Reattach tokenModel to the dialog fragment
                    const tokenModel =
                        that.tokenModel ||
                        new sap.ui.model.json.JSONModel({
                            tokens: [],
                        });
                    oDialog.setModel(tokenModel, "tokenModel");
                    const fileUploader = sap.ui.core.Fragment.byId("jobFormFrag", "jobFileUploader");
                    if (fileUploader) {
                        fileUploader.data("required", true);
                    }

                    //  Set DOB min/max range
                    const oToday = new Date();
                    const oMinDOB = new Date(oToday.getFullYear() - 65, oToday.getMonth(), oToday.getDate());
                    const oMaxDOB = new Date(oToday.getFullYear() - 18, oToday.getMonth(), oToday.getDate());
                    const oDatePicker = Fragment.byId("jobFormFrag", "dobPicker");
                    if (oDatePicker) {
                        oDatePicker.setMinDate(oMinDOB);
                        oDatePicker.setMaxDate(oMaxDOB);
                        // set datepicker focus to 2000-01-01
                        oDatePicker.setInitialFocusedDateValue(new Date(2000, 0, 1));
                    }

                    // local json countries file
                    const oCountryModel = new sap.ui.model.json.JSONModel();
                    oCountryModel.loadData("model/countries.json");
                    // oCountryModel.setSizeLimit(250); //  //
                    that.getView().setModel(oCountryModel, "countries");
                    oCountryModel.attachRequestCompleted(function() {});

                    const oCities = new sap.ui.model.json.JSONModel();
                    oCities.loadData("model/cities.json");
                    oCities.setSizeLimit(500);
                    that.getView().setModel(oCities, "cities");

          oCities.attachRequestCompleted(function () { });

                    const oQualModel = new sap.ui.model.json.JSONModel();
                    oQualModel.loadData("model/qualifications.json");
                    that.getView().setModel(oQualModel, "qualifications");

                    const oUniModel = new sap.ui.model.json.JSONModel();
                    oUniModel.loadData("model/universities.json");
                    oUniModel.setSizeLimit(1000);
                    that.getView().setModel(oUniModel, "universities");

                    oUniModel.attachRequestCompleted(function() {});
          oUniModel.attachRequestCompleted(function () { });

                    //PreviousJob model definition
                    const oPrevJobModel = new sap.ui.model.json.JSONModel();
                    oPrevJobModel.loadData("model/PreviousJobTitles.json");
                    that.getView().setModel(oPrevJobModel, "DesignationModel");

                    // notice period model
                    const oNoticePeriod = new sap.ui.model.json.JSONModel();
                    oNoticePeriod.loadData("model/noticePeriod.json");
                    //oCities.setSizeLimit(500);
                    that.getView().setModel(oNoticePeriod, "noticePeriod");

                    const oISDModel = new sap.ui.model.json.JSONModel();
                    oISDModel.loadData("model/isd.json");
                    oISDModel.setSizeLimit(300);
                    oISDModel.attachRequestCompleted(function() {
                        const aAllISD = oISDModel.getData()?.ISDCodes || [];

                        //  Extract unique ISD codes based on "text"
                        const seen = {};
                        const aUniqueISD = aAllISD.filter((item) => {
                            if (!seen[item.text]) {
                                seen[item.text] = true;
                                return true;
                            }
                            return false;
                        });

                        //  Set cleaned list back to model
                        oISDModel.setData({
                            ISDCodes: aUniqueISD,
                        });
                    });

                    // bind to view
                    that.getView().setModel(oISDModel, "isd");

                    //  Year of Passing: allow selection only between current year and 45 years back
                    const oYearPicker = Fragment.byId("jobFormFrag", "PassingYear");
                    if (oYearPicker) {
                        const oToday = new Date();
                        const oMaxYear = new Date(oToday.getFullYear(), 11, 31); // Current year end
                        const oMinYear = new Date(oToday.getFullYear() - 45, 0, 1); // Jan 1st 45 years ago

                        oYearPicker.setMinDate(oMinYear);
                        oYearPicker.setMaxDate(oMaxYear);

                        const oToday2 = new Date();

                        //  DOB limits
                        const oMinDOB = new Date(oToday2.getFullYear() - 65, oToday2.getMonth(), oToday2.getDate());
                        const oMaxDOB = new Date(oToday2.getFullYear() - 18, oToday2.getMonth(), oToday2.getDate());
                        const oDOB = Fragment.byId("jobFormFrag", "dobPicker");
                        if (oDOB) {
                            oDOB.setMinDate(oMinDOB);
                            oDOB.setMaxDate(oMaxDOB);
                        }

                        //  Work Experience limits (30 years ago to 90 days ahead)
                        const oExpRange = Fragment.byId("jobFormFrag", "experienceRange");
                        if (oExpRange) {
                            const oMinStart = new Date(oToday2.getFullYear() - 30, oToday2.getMonth(), oToday2.getDate());
                            const oMaxEnd = new Date(oToday2.getTime() + 90 * 24 * 60 * 60 * 1000);

                            oExpRange.setMinDate(oMinStart);
                            oExpRange.setMaxDate(oMaxEnd);
                        }
                        oDialog.open();
                    }
                });
            } else {
                this._oJobDialog.open(); //  Now this is safe and will not error
            }
        },

        onClose: function() {
            if (this._oJobDialog) {
                this._oJobDialog.close();
                this.getView().getModel("tokenModel").setProperty("/tokens", []);
                this._oJobDialog.destroy();
                this._oJobDialog = null;
            }
        },

        onLiveChangeFullName: function(oEvent) {
            utils._LCvalidateName(oEvent);
        },

        onCompanyChange: function(oEvent) {
            utils._LCvalidateMandatoryField(oEvent);
        },

        onEmailChange: function(oEvent) {
            utils._LCvalidateEmail(oEvent);
        },

        onAddressChange: function(oEvent) {
            const oInput = oEvent.getSource();
            const sValue = oInput.getValue().trim();

            if (!sValue) {
                // Empty is allowed
                oInput.setValueState("None");
                oInput.setValueStateText("");
                return;
            }

            if (sValue.length < 8) {
                oInput.setValueState("Error");
                oInput.setValueStateText("Address must be at least 8 characters long");
            } else {
                oInput.setValueState("None");
                oInput.setValueStateText("");
            }
        },

        onLearningChange: function(oEvent) {
            const oSource = oEvent.getSource();
            const sValue = oSource.getValue().trim();

            if (!sValue) {
                oSource.setValueState("None");
                oSource.setValueStateText("");
                return;
            }

            if (sValue.length < 8) {
                oSource.setValueState("Error");
                oSource.setValueStateText("Minimum 8 characters on Learning Journey");
            } else {
                oSource.setValueState("None");
                oSource.setValueStateText("");
            }
        },

        onExpertiseChange: function(oEvent) {
            utils._LCvalidateMandatoryField(oEvent);
        },

        onSkillsChange: function(oEvent) {
            var oInput = oEvent.getSource();
            var sValue = oInput.getValue();

            var sTrimmed = sValue.trim();

            var bMinLength = sValue.length >= 8;

            var letterMatches = sValue.match(/[a-zA-Z]/g);
            var bHasEnoughLetters = letterMatches && letterMatches.length >= 8;

            var bNotOnlySpaces = !/^\s*$/.test(sValue); // not just spaces
            var bNotOnlyDots = !/^[.]+$/.test(sValue); // not just dots

            if (!bMinLength || !bHasEnoughLetters || !bNotOnlySpaces || !bNotOnlyDots) {
                oInput.setValueState(sap.ui.core.ValueState.Error);
                const sMessage = this.oResourceBundle.getText("v2_m_errSkills");

                oInput.setValueStateText(sMessage);
            } else {
                oInput.setValueState(sap.ui.core.ValueState.None);
                oInput.setValueStateText("");
            }
        },
        onDOBChange: function(oEvent) {
            var oDatePicker = oEvent.getSource();
            var sId = oDatePicker.getId();

            this._makeDatePickersReadOnly([sId]);

            var oSelectedDate = oDatePicker.getDateValue();
            var sRawValue = oDatePicker.getValue();

            // 1. If field is empty — valid (optional field)
            if (!sRawValue) {
                oDatePicker.setValueState(sap.ui.core.ValueState.None);
                oDatePicker.setValueStateText("");
                return;
            }

            // 2. If input is non-empty, but parsed date is invalid — error
            if (!oSelectedDate || isNaN(oSelectedDate.getTime())) {
                oDatePicker.setValueState(sap.ui.core.ValueState.Error);
                const sMessage = this.oResourceBundle.getText("v2_m_errDOB");
                oDatePicker.setValueStateText(sMessage);
                return;
            }

            // 3. Valid date selected — perform age validation
            var oToday = new Date();

            var oMaxDOB = new Date(oToday.getFullYear() - 18, oToday.getMonth(), oToday.getDate());
            var oMinDOB = new Date(oToday.getFullYear() - 65, oToday.getMonth(), oToday.getDate());

            if (oSelectedDate > oMaxDOB) {
                oDatePicker.setValueState(sap.ui.core.ValueState.Error);
                const sMessage = this.oResourceBundle.getText("v2_m_err18YO"); // e.g., "Must be at least 18"
                oDatePicker.setValueStateText(sMessage);
            } else if (oSelectedDate < oMinDOB) {
                oDatePicker.setValueState(sap.ui.core.ValueState.Error);
                const sMessage = this.oResourceBundle.getText("v2_m_err65YO"); // e.g., "Must be younger than 65"
                oDatePicker.setValueStateText(sMessage);
            } else {
                oDatePicker.setValueState(sap.ui.core.ValueState.None);
                oDatePicker.setValueStateText("");
            }
        },

        onSalaryChange: function(oEvent) {
            const oInput = oEvent.getSource();
            let sValue = oInput.getValue();

            // Remove invalid characters (allow only digits and dot)
            sValue = sValue.replace(/[^0-9.]/g, "");

            // Only allow one dot
            const parts = sValue.split(".");
            if (parts.length > 2) {
                parts.splice(2); // Keep only first two parts
            }

            // Limit decimal digits to 2
            if (parts[1]) {
                parts[1] = parts[1].substring(0, 2);
            }

            let cleanValue = parts.join(".");

            // If value starts with multiple 0s before a digit (like 007), strip leading 0s
            if (/^0\d/.test(cleanValue)) {
                cleanValue = cleanValue.replace(/^0+/, "");
            }

            // Edge case: if user types only ".", prepend 0
            if (cleanValue === ".") {
                cleanValue = "0.";
            }

            oInput.setValue(cleanValue);

            // Validate final value
            const floatVal = parseFloat(cleanValue);
            const isValidFormat = /^\d{1,2}(\.\d{1,2})?$/.test(cleanValue);
            const isWithinRange = floatVal >= 0.5 && floatVal <= 99.0;

            if (isValidFormat && isWithinRange) {
                oInput.setValueState(sap.ui.core.ValueState.None);
                oInput.setValueStateText("");
            } else {
                oInput.setValueState(sap.ui.core.ValueState.Error);
                const sMessage = this.oResourceBundle.getText("v2_m_errSal");
                oInput.setValueStateText(sMessage);
            }
        },

        onExperienceToggle: function(oEvent) {
            const fragId = "jobFormFrag";
            const bIsExperienced = oEvent.getParameter("state");

            const oExpSection = sap.ui.core.Fragment.byId(fragId, "experienceSection");
            const oFreshSection = sap.ui.core.Fragment.byId(fragId, "fresherSection");

            // Helper to clear values and error states
            const clearSectionInputs = (section) => {
                if (!section || !section.getItems) return;
                section.getItems().forEach((ctrl) => {
                    if (typeof ctrl.setValue === "function") ctrl.setValue("");
                    if (typeof ctrl.setSelectedKey === "function") ctrl.setSelectedKey("");
                    if (typeof ctrl.setDateValue === "function") ctrl.setDateValue(null);
                    if (typeof ctrl.setValueState === "function") ctrl.setValueState("None");
                });
            };

            // Toggle visibility
            oExpSection.setVisible(bIsExperienced);
            oFreshSection.setVisible(!bIsExperienced);

            // Clear inputs in the section that is being hidden
            if (bIsExperienced) {
                clearSectionInputs(oFreshSection);
            } else {
                clearSectionInputs(oExpSection);
            }
        },

        onExperienceChange: function(oEvent) {
            const oInput = oEvent.getSource();
            const sValue = oInput.getValue().trim();

            const fValue = parseFloat(sValue);
            const isValid = /^[0-9]+(\.[0-9]{1,2})?$/.test(sValue) && fValue >= 0.1 && fValue <= 30;

            if (!isValid) {
                oInput.setValueState("Error");

                const sMessage = this.oResourceBundle.getText("v2_m_errExp");
                oInput.setValueStateText(sMessage);
            } else {
                oInput.setValueState("None");
            }
        },
        validateStartEndDates: function(oStartDatePicker, oEndDatePicker) {
            const oStart = oStartDatePicker.getDateValue();
            const oEnd = oEndDatePicker.getDateValue();
            const oToday = new Date();

            if (!oStart || !oEnd || oStart > oEnd || oEnd > oToday) {
                oEndDatePicker.setValueState("Error");
                const sMessage = this.oResourceBundle.getText("v2_m_errEnddate");
                oEndDatePicker.setValueStateText(sMessage);
            } else {
                oEndDatePicker.setValueState("None");
            }
        },

        // ...existing code...
        onPassingYearChange: function(oEvent) {
            const oDatePicker = oEvent.getSource();
            const sValue = oDatePicker.getValue().trim(); // User input string
            const oToday = new Date();
            const minYear = oToday.getFullYear() - 45;
            const maxYear = oToday.getFullYear();

            // Allow empty input (optional field)
            if (!sValue) {
                oDatePicker.setValueState("None");
                oDatePicker.setValueStateText("");
                return;
            }

            // If input is not a 4-digit year
            if (!/^\d{4}$/.test(sValue)) {
                oDatePicker.setValueState("Error");
                oDatePicker.setValueStateText(`Enter a valid year between ${minYear} and ${maxYear}`);
                return;
            }

            const year = parseInt(sValue, 10);
            if (year < minYear || year > maxYear) {
                oDatePicker.setValueState("Error");
                oDatePicker.setValueStateText(`Enter a year between ${minYear} and ${maxYear}`);
                return;
            }

            // Valid year
            oDatePicker.setValueState("None");
            oDatePicker.setValueStateText("");
        },

        // ...existing code...
        onComboBoxChange: function(oEvent) {
            const combo = oEvent.getSource();
            const selectedKey = combo.getSelectedKey();

            if (combo.getRequired && combo.getRequired()) {
                if (!selectedKey || selectedKey.trim() === "") {
                    combo.setValueState("Error");
                    combo.setValueStateText("Please Choose from List");
                } else {
                    combo.setValueState("None");
                }
            }
        },

        onNoticePeriodChange: function(oEvent) {
            utils._LCstrictValidationComboBox(oEvent);
        },

        onEmpTypeChange: function(oEvent) {
            const oComboBox = oEvent.getSource();
            const sValue = oComboBox.getValue().trim();

            if (!sValue) {
                oComboBox.setValueState("None");
                oComboBox.setValueStateText("");
                return;
            }

            // FIX: Pass the full event
            utils._LCstrictValidationComboBox(oEvent);
        },

        onDesignationChange: function(oEvent) {
            const oComboBox = oEvent.getSource();
            const sValue = oComboBox.getValue().trim();

            if (!sValue) {
                oComboBox.setValueState("None");
                oComboBox.setValueStateText("");
                return;
            }

            // FIX: Pass the full event
            utils._LCvalidateMandatoryField(oEvent);
        },
        onQalificationChange: function(oEvent) {
            utils._LCstrictValidationComboBox(oEvent);
        },

        onUniversityChange: function(oEvent) {
            const oInput = oEvent.getSource();
            const university = oInput.getValue().trim();

            // Allow empty
            if (!university) {
                oInput.setValueState("None");
                oInput.setValueStateText("");
                return;
            }

            // Basic format rule: only letters, numbers, and certain punctuation
            const isValidFormat = /^[A-Za-z0-9\s\-.,()]+$/.test(university);

            // Must contain at least one alphabet
            const hasAlphabet = /[A-Za-z]/.test(university);

            if (university.length < 8) {
                oInput.setValueState("Error");
                oInput.setValueStateText("University name must be at least 8 characters.");
                return;
            }

            if (!isValidFormat) {
                oInput.setValueState("Error");
                oInput.setValueStateText("Only letters, numbers, spaces, hyphens, commas, periods, and parentheses allowed");
                return;
            }

            if (!hasAlphabet) {
                oInput.setValueState("Error");
                oInput.setValueStateText("University name must include at least one letter");
                return;
            }

            oInput.setValueState("None");
            oInput.setValueStateText("");
        },

        onGenderChange: function(oEvent) {
            const oComboBox = oEvent.getSource();
            const sValue = oComboBox.getValue().trim();

      if (!sValue) {
        oComboBox.setValueState("None");
        oComboBox.setValueStateText("");
        return;
      }
      utils._LCstrictValidationComboBox(oEvent, "genderInvalid");
    },
    MC_onBaseLocationChange: function (oEvent) {
      try {
        const oComboBox = oEvent.getSource();
        const sEnteredKey = oComboBox.getValue();
        const sSelectedKey = oComboBox.getSelectedKey();

        if (!sEnteredKey) {
          // Empty input is allowed
          oComboBox.setValueState("None");
          oComboBox.setValueStateText("");
          return;
        }

        const aItems = oComboBox.getItems();
        const bValidMatch = aItems.some(function (oItem) {
          return oItem.getText().toLowerCase() === sEnteredKey.toLowerCase() || oItem.getKey().toLowerCase() === sEnteredKey.toLowerCase();
        });

        if (!bValidMatch) {
          oComboBox.setValueState("Error");
          oComboBox.setValueStateText("Please select a valid location from the list");
        } else {
          oComboBox.setValueState("None");
          oComboBox.setValueStateText("");
        }
      } catch (err) { }
    },

    ajaxCreateWithJQuery: function (sUrl, oPayLoad) {
      return new Promise((resolve, reject) => {
        $.ajax({
          url: "https://rest.kalpavrikshatechnologies.com/" + sUrl,
          method: "POST",
          data: JSON.stringify(oPayLoad),
          contentType: "application/json",
          headers: {
            name: "$2a$12$LC.eHGIEwcbEWhpi9gEA.umh8Psgnlva2aGfFlZLuMtPFjrMDwSui",
            password: "$2a$12$By8zKifvRcfxTbabZJ5ssOsheOLdAxA2p6/pdaNvv1xy1aHucPm0u",
          },
          success: resolve,
          error: reject,
        });
      });
    },
    _validateMobileNumberLocal: function (oEvent) {
      const oInput = oEvent.getSource();
      const sValue = oInput.getValue();
      const sValueTrimmed = sValue.trim();

            const iMaxLength = oInput.getMaxLength();
            oInput.setValueState(sap.ui.core.ValueState.None);
            oInput.setValueStateText("");

            // mobile number cannot start with 0
            if (sValue.startsWith("0")) {
                oInput.setValueState(sap.ui.core.ValueState.Error);
                oInput.setValueStateText("Mobile number cannot begin with 0");
                return false;
            }

            // only numbers allowed
            if (!/^\d*$/.test(sValue)) {
                oInput.setValueState(sap.ui.core.ValueState.Error);
                oInput.setValueStateText("Only numbers are allowed");
                return false;
            }

            // validate length
            if (iMaxLength === 10) {
                if (sValue.length !== 10) {
                    oInput.setValueState(sap.ui.core.ValueState.Error);
                    oInput.setValueStateText("Mobile number must be 10 digits long");
                    return false;
                }
            } else {
                if (sValue.length < 4 || sValue.length > 20) {
                    oInput.setValueState(sap.ui.core.ValueState.Error);
                    oInput.setValueStateText("Mobile number must be between 4 and 20 digits long");
                    return false;
                }
            }

            return true;
        },

        _setMobileMaxLength: function(sCountryCode) {
            const oJobModel = this.getView().getModel("JobModel");
            const oMobileInput = Fragment.byId("jobFormFrag", "mobileInput");
            if (!oMobileInput) return;

            oMobileInput.setValue("");
            oJobModel.setProperty("/mobile", "");

            if (sCountryCode === "IN") {
                oMobileInput.setMaxLength(10);
            } else {
                oMobileInput.setMaxLength(20);
            }
        },

        MC_ValidateISD: function(oEvent) {
            utils._LCstrictValidationComboBox(oEvent);

            const oComboBox = oEvent.getSource();
            const selectedKey = oComboBox.getSelectedKey();

            const oJobModel = this.getView().getModel("JobModel");

            const oCountryModel = this.getView().getModel("CountryModel");
            const aItems = oCountryModel.getProperty("/");

            const oMatch = aItems.find((item) => item.stdCode === selectedKey);

            if (oJobModel) {
                oJobModel.setProperty("/stdCode", selectedKey); // ISD
                oJobModel.setProperty("/country", oMatch ? oMatch.code : ""); // CountryCode
            }

            this._setMobileMaxLength(oMatch ? oMatch.code : "");
        },

        MC_onChangeCountry: function(oEvent) {
            try {
                const oComboBox = oEvent.getSource();
                const sInputValue = oComboBox.getValue();
                const aItems = oComboBox.getItems();
                const oView = this.getView();
                const oModel = oView.getModel("JobModel");

                // 1. If blank → reset everything
                if (!sInputValue) {
                    oComboBox.setValueState("None").setValueStateText("").setSelectedKey("");
                    if (oModel) {
                        oModel.setProperty("/country", "");
                        oModel.setProperty("/stdCode", "");
                    }

                    // Clear ISD
                    const oISDCombo = Fragment.byId("jobFormFrag", "isd_code");
                    if (oISDCombo) {
                        oISDCombo.setSelectedKey("");
                        oISDCombo.setEnabled(true);
                        oISDCombo.getBinding("items")?.filter([]);
                    }

                    // Clear States
                    const oStateCombo = Fragment.byId("jobFormFrag", "StateComboBox");
                    if (oStateCombo) {
                        oStateCombo.setSelectedKey("");
                        oStateCombo.getBinding("items")?.filter([]);
                    }

                    // Clear Cities
                    const oCityCombo = Fragment.byId("jobFormFrag", "LocationComboBox");
                    if (oCityCombo) {
                        oCityCombo.setSelectedKey("");
                        oCityCombo.getBinding("items")?.filter([]);
                    }

                    // Reset Mobile
                    const oMobileInput = Fragment.byId("jobFormFrag", "mobileInput");
                    if (oMobileInput) {
                        oMobileInput.setValue("");
                        oMobileInput.setMaxLength(20);
                    }
                    return;
                }

                // 2. Validate entered country
                const oMatchedItem = aItems.find((item) => item.getText().toLowerCase() === sInputValue.toLowerCase() || item.getKey().toLowerCase() === sInputValue.toLowerCase());

                if (!oMatchedItem) {
                    oComboBox.setValueState("Error");
                    oComboBox.setValueStateText(this.oResourceBundle.getText("JobAppExpValStaCountry"));
                    return;
                }

                // 3. Valid country → set key + model
                const selectedKey = oMatchedItem.getKey().toUpperCase();
                oComboBox.setSelectedKey(selectedKey).setValueState("None").setValueStateText("");
                oModel?.setProperty("/country", selectedKey);

                // 4. Filter ISD codes
                // Inside step 4
                const oISDCombo = Fragment.byId("jobFormFrag", "isd_code");
                if (oISDCombo?.getBinding("items")) {
                    const oISDFilter = new sap.ui.model.Filter("code", "EQ", selectedKey); // CountryCode
                    oISDCombo.getBinding("items").filter([oISDFilter]);

                    setTimeout(() => {
                        const aISDItems = oISDCombo.getItems();
                        if (aISDItems.length === 1) {
                            const sCode = aISDItems[0].getBindingContext("CountryModel").getObject().stdCode;
                            oISDCombo.setSelectedKey(sCode);
                            oISDCombo.setEnabled(false);
                            oModel.setProperty("/stdCode", sCode);
                        } else {
                            oISDCombo.setSelectedKey("");
                            oISDCombo.setEnabled(true);
                            oModel.setProperty("/stdCode", "");
                        }
                    }, 0);
                }

                // --- Filter states based on selected country ---
                const oStateCombo = Fragment.byId("jobFormFrag", "stateCombo");
                if (oStateCombo?.getBinding("items")) {
                    const oStateFilter = new sap.ui.model.Filter("countryCode", "EQ", selectedKey); // selectedKey = CountryCode
                    oStateCombo.getBinding("items").filter([oStateFilter]);

                    // Reset JobModel state + city
                    oModel.setProperty("/state", "");
                    oModel.setProperty("/city", "");
                }

                // 6. Clear & reset Cities when country changes
                const oCityCombo = Fragment.byId("jobFormFrag", "LocationComboBox");
                if (oCityCombo?.getBinding("items")) {
                    oCityCombo.getBinding("items").filter([]);
                    oCityCombo.setSelectedKey("");
                }

                // 7. Mobile input length logic
                const sSelectedCountryCode = oEvent.getSource().getSelectedKey(); // CountryCode like IN, US
                const aCountries = this.getView().getModel("CountryModel").getData();

                // Match by country code
                const oSelectedCountry = aCountries.find((c) => c.code === sSelectedCountryCode);

                if (oSelectedCountry) {
                    const oJobModel = this.getView().getModel("JobModel");
                    oJobModel.setProperty("/country", oSelectedCountry.code); // IN, US, etc.
                    oJobModel.setProperty("/stdCode", oSelectedCountry.stdCode); // ISD code
                }

                // Pass the resolved country code (IN/US/etc.)
                this._setMobileMaxLength(oSelectedCountry ? oSelectedCountry.code : "");
            } catch (error) {
                console.error("Error in MC_onChangeCountry:", error);
            }
        },

        MC_onChangeCity: function(oEvent) {
            try {
                const oComboBox = oEvent.getSource();
                const sEnteredKey = oComboBox.getValue();

                if (!sEnteredKey) {
                    oComboBox.setValueState("None");
                    oComboBox.setValueStateText("");
                    return;
                }

                const aItems = oComboBox.getItems();
                const bValidMatch = aItems.some((oItem) => oItem.getText().toLowerCase() === sEnteredKey.toLowerCase() || oItem.getKey().toLowerCase() === sEnteredKey.toLowerCase());

                if (!bValidMatch) {
                    oComboBox.setValueState("Error");
                    oComboBox.setValueStateText("Please select a valid city from the list");
                } else {
                    oComboBox.setValueState("None");
                    oComboBox.setValueStateText("");
                }
            } catch (err) {
                console.error("Error in MC_onChangeCity:", err);
            }
        },

        MC_onChangeState: function(oEvent) {
            const sStateName = oEvent.getSource().getSelectedKey();

            // --- Filter Cities by State ---
            const oCityCombo = sap.ui.core.Fragment.byId("jobFormFrag", "LocationComboBox");
            const oCityBinding = oCityCombo.getBinding("items");
            if (oCityBinding) {
                oCityBinding.filter([new sap.ui.model.Filter("stateName", sap.ui.model.FilterOperator.EQ, sStateName)]);
            }

            oCityCombo.setSelectedKey("");
        },

       onSubmit: async function() {
    const i18n = this.oResourceBundle;
    const f = (id) => sap.ui.core.Fragment.byId("jobFormFrag", id);

    const getControlValue = (oCtrl) => {
        if (!oCtrl) return "";
        if (typeof oCtrl.getValue === "function") return oCtrl.getValue().trim();
        if (typeof oCtrl.getSelectedKey === "function") return oCtrl.getSelectedKey().trim();
        if (typeof oCtrl.getState === "function") return oCtrl.getState();
        return "";
    };

    const scrollToError = (oControl) => {
        if (oControl?.getDomRef?.()) {
            oControl.getDomRef().scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        }
    };

    const validateSalaryField = function(oEvent) {
        const oCtrl = oEvent.getSource();
        const val = getControlValue(oCtrl);
        const num = parseFloat(val);
        const isValid = /^\d{1,2}(\.\d{1,2})?$/.test(val) && num >= 0.5 && num <= 99;

        if (!isValid) {
            oCtrl.setValueState("Error");
            oCtrl.setValueStateText(i18n.getText("v2_m_errSal"));
            return false;
        }

        oCtrl.setValueState("None");
        oCtrl.setValueStateText("");
        return true;
    };

    const validateInOrder = (checks) => {
        for (const { ctrl, fn } of checks) {
            if (!ctrl) {
                continue;
            }

            const valid = fn.call(this, {
                getSource: () => ctrl
            });

            if (!valid) {
                scrollToError(ctrl);
                MessageToast.show(i18n.getText("mandetoryFields"));
                return false;
            }
        }
        return true;
    };

    const oExperienceSection = f("experienceSection");
    const oFresherSection = f("fresherSection");

    const isExperienced = oExperienceSection?.getVisible?.() === true;
    const isFresher = oFresherSection?.getVisible?.() === true;

    const mandatoryChecks = [
        {
            ctrl: f("fullNameInput"),
            fn: utils._LCvalidateMandatoryField
        },
        {
            ctrl: f("emailInput"),
            fn: utils._LCvalidateEmail
        },
        {
            ctrl: f("isd_code"),
            fn: utils._LCstrictValidationComboBox
        },
        {
            ctrl: f("mobileInput"),
            fn: this._validateMobileNumberLocal
        },
        {
            ctrl: f("qualificationCombo"),
            fn: utils._LCstrictValidationComboBox
        },
        {
            ctrl: f("skillsInput"),
            fn: utils._LCvalidateMandatoryField
        }
    ];

    if (isExperienced) {
        mandatoryChecks.push(
            {
                ctrl: f("experienceInput"),
                fn: utils._LCvalidateMandatoryField
            },
            {
                ctrl: f("companyInput"),
                fn: utils._LCvalidateMandatoryField
            },
            {
                ctrl: f("salaryInput"),
                fn: validateSalaryField
            },
            {
                ctrl: f("expectedSalaryInput"),
                fn: validateSalaryField
            },
            {
                ctrl: f("noticePeriodCombo"),
                fn: utils._LCstrictValidationComboBox
            }
        );
    } else if (isFresher) {
        mandatoryChecks.push({
            ctrl: f("fresherExpertiseInput"),
            fn: utils._LCvalidateMandatoryField
        });
    }

    const allFieldsValid = validateInOrder(mandatoryChecks);
    if (!allFieldsValid) return;

    const tokenModel = this.getView().getModel("tokenModel");
    const files = tokenModel?.getProperty("/tokens") || [];

    const fileErrorLayout = f("fileErrorLayout");
    const fileErrorText = f("fileErrorText");

    if (!files.length) {
        if (fileErrorLayout && fileErrorText) {
            fileErrorLayout.setVisible(true);
            fileErrorText.setVisible(true);
            fileErrorText.setText(i18n.getText("uploadRequired") || "Resume upload is required.");
        }
        scrollToError(f("id_tokenizer"));
        return;
    } else {
        if (fileErrorLayout && fileErrorText) {
            fileErrorLayout.setVisible(false);
            fileErrorText.setVisible(false);
        }
    }

    const oPayload = this.getFormDataAsJSON();

    this.getBusyDialog();

    try {
        await this.ajaxCreateWithJQuery("JobApplications", {
            data: oPayload
        });
            this._oJobDialog.close();
        MessageBox.success("Your Job Application Submitted Successfully!", {
            onClose: () => {
                this.onClose();
            }
        });
    } catch (err) {
        MessageToast.show(err.message || "Submission failed.");
    } finally {
        this.closeBusyDialog();
    }
},

        _appendComboTextFields: function(jsonData) {
            const f = (id) => sap.ui.core.Fragment.byId("jobFormFrag", id);
            const appendCombo = (id, field) => {
                const combo = f(id);
                if (combo) {
                    const selectedText = combo.getSelectedItem()?.getText?.();
                    const typedValue = combo.getValue?.();
                    jsonData[field] = typedValue || selectedText || "";
                }
            };

            appendCombo("isd_code", "ISD");
            appendCombo("countryCombo", "Country");
            // appendCombo("LocationComboBox", "City");
            if (!jsonData.City) {
                appendCombo("LocationComboBox", "City");
            }

            appendCombo("previousJobTitleCombo", "Designation");
            appendCombo("universityCombo", "University");
            appendCombo("noticePeriodCombo", "NoticePeriod");

            const qualCombo = f("qualificationCombo");
            if (qualCombo) {
                const value = qualCombo.getSelectedItem()?.getText?.() || qualCombo.getValue?.();
                jsonData.HighestQualifaction = value || "";
            }
        },

        onRemoveFile: function() {
            const fileUploader = sap.ui.core.Fragment.byId("jobFormFrag", "FileUploader");

            fileUploader.setValue("");
            fileUploader.setValueState("Error");
            fileUploader.setValueStateText("Please upload your resume");

            // Remove any previously selected file reference
            this.oSelectedFile = null;

            sap.m.MessageToast.show("File removed. Please upload your resume");
        },

        onSharePress: function(oEvent) {
            const createItem = (iconPath, title, pressHandler) => {
                return new sap.m.CustomListItem({
                    type: "Active",
                    press: pressHandler,
                    content: [
                        new sap.m.HBox({
                            alignItems: "Center",
                            justifyContent: "Start",
                            width: "100%",
                            items: [
                                new sap.m.Image({
                                    src: iconPath,
                                    width: "18px",
                                    height: "18px",
                                    decorative: false,
                                }).addStyleClass("shareIcon"),
                                new sap.m.Text({
                                    text: title,
                                }).addStyleClass("shareText"),
                            ],
                        }).addStyleClass("shareItemBox"),
                    ],
                });
            };

            const oSource = oEvent.getSource();

            // If Popover already exists and is open, close it
            if (this._oSharePopover && this._oSharePopover.isOpen()) {
                this._oSharePopover.close();
                return;
            }

      if (!this._oSharePopover) {
        const oJobModel = this.getView().getModel("JobApplicationModel");
        const sJobId = oJobModel?.getProperty("/ID") || "";
        const sBaseURL = window.location.origin + window.location.pathname;
        const sHash = "#/JobView/" + encodeURIComponent(sJobId);
        const sFullShareURL = `${sBaseURL}?sap-ui-xx-viewCache=false${sHash}`;
        const sMessage = `Explore this exciting opportunity at Kvriksha Technologies Private Limited.\nApply now or share it with someone who might be a great fit\n${sFullShareURL}`;

                const items = [
                    createItem("image/linkedin.png", "LinkedIn", () => {
                        this._oSharePopover.close();
                        window.open("https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(sFullShareURL), "_blank");
                        sap.m.MessageToast.show("Opening LinkedIn...");
                    }),

          createItem("image/Mail.png", "Email", () => {
            this._oSharePopover.close();
            const sSubject =
              "Exciting Job Opportunity at Kvriksha Technologies Private Limited";
            window.location.href =
              "mailto:?subject=" +
              encodeURIComponent(sSubject) +
              "&body=" +
              encodeURIComponent(sMessage);
          }),

                    createItem("image/Whatsapp.png", "WhatsApp", () => {
                        this._oSharePopover.close();
                        window.open("https://api.whatsapp.com/send?text=" + encodeURIComponent(sMessage), "_blank");
                        sap.m.MessageToast.show("Opening WhatsApp...");
                    }),

                    createItem("image/Link.png", "Copy Link", () => {
                        this._oSharePopover.close();
                        navigator.clipboard.writeText(sFullShareURL);
                        sap.m.MessageToast.show("Link copied");
                    }),
                ];
                const lastHBox = items[items.length - 1].getContent()[0];
                lastHBox.removeStyleClass("shareItemBox");
                lastHBox.addStyleClass("shareItemBoxLast");

                this._oSharePopover = new sap.m.Popover({
                    placement: sap.m.PlacementType.Bottom,
                    showHeader: false,
                    contentWidth: "150px",
                    content: [
                        new sap.m.List({
                            items: items,
                        }),
                    ],
                });
            }

            this._oSharePopover.openBy(oSource);
        },

        onLinkedInPress: function() {
            window.open("https://linkedin.com", "_blank");
        },

        onEmailPress: function() {
            window.location.href = "mailto:?subject=Check this out&body=" + encodeURIComponent(window.location.href);
        },

        onWhatsAppPress: function() {
            const url = encodeURIComponent(window.location.href);
            window.open("https://wa.me/?text=" + url, "_blank");
        },

        onCopyLinkPress: function() {
            navigator.clipboard.writeText(window.location.href);
            sap.m.MessageToast.show("Link copied!");
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
                                    text: this.oResourceBundle.getText("salaryPackageInfo"),
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