sap.ui.define(
    [
        "./BaseController",
        "../utils/validation",
        "sap/ui/model/json/JSONModel",
        "sap/m/MessageToast",
        "../model/formatter",
    ],
    function(BaseController, utils, JSONModel, MessageToast, Formatter) {
        "use strict";

        return BaseController.extend(
            "sap.kt.com.minihrsolution.controller.HomePage", {
                Formatter: Formatter,
                onInit: function() {

                    this.getRouter().getRoute("RouteHomePage").attachMatched(this._onRouteMatched, this);
                    this.getView().getModel("CountryModel")
                    // Form Data
                    // var oFormData = new JSONModel({
                    //   CustomerName: "",
                    //   CompanyName: "",
                    //   Email: "",
                    //   Address: "",
                    //   TimeSlot: "",
                    //   stdCode: "+91",
                    //   MobileNo: "",
                    //   Comments: "",
                    // });
                    // this.getView().setModel(oFormData, "formData");

                    // Load carousel videos etc. when route matches
                    this._careerDataLoaded = false; // flag to avoid repeated fetch
                },

                _onRouteMatched: function() {
                    this.i18nModel = this.getView().getModel("i18n").getResourceBundle();
                    const sStoredTab = sessionStorage.getItem("homePageReturnTab") || "idHome";
                    const oTabHeader = this.byId("mainTabHeader");
                    if (oTabHeader) {
                        oTabHeader.setSelectedKey(sStoredTab);
                    }

                    const oNavContainer = this.byId("pageContainer");
                    if (oNavContainer) {
                        const oPage = this.byId(sStoredTab);
                        if (oPage) {
                            oNavContainer.to(oPage);
                        }
                    }

                    sessionStorage.removeItem("homePageReturnTab");
                    this.API = "https://rest.kalpavrikshatechnologies.com";


                    // var oCarousel = this.byId("videoCarousel");

                    // var videoUrls = [
                    //   "../video/Employee offer.mp4",
                    //   "../video/Self Service.mp4",
                    //   "../video/Employee details Part 1.mp4",
                    //   "../video/Quotation.mp4",
                    //   "../video/Scheme upload.mp4",
                    // ];

                    // // Add videos dynamically to the carousel
                    // videoUrls.forEach(function (url, index) {
                    //   var oHtmlControl = new sap.ui.core.HTML({
                    //     content:
                    //       '<video width="100%" height="100%" autoplay muted loop>' +
                    //       '<source src="' +
                    //       url +
                    //       '" type="video/mp4">' +
                    //       "</video>",
                    //   });

                    //   var oVBox = new sap.m.VBox({
                    //     alignItems: "Center",
                    //     items: [
                    //       new sap.m.Title({
                    //         level: "H2",
                    //         class: "custom-text2",
                    //       }),
                    //       oHtmlControl,
                    //     ],
                    //   });

                    //   oVBox.addStyleClass("sapUiTinyMargin"); // Apply transparent background class
                    //   oCarousel.addPage(oVBox);
                    // });

                    // var iCurrentIndex = 0;
                    // var aPages = oCarousel.getPages(); // Get all slides

                    // function autoSlide() {
                    //   if (aPages.length > 1) {
                    //     iCurrentIndex = (iCurrentIndex + 1) % aPages.length; // Move to next slide
                    //     oCarousel.setActivePage(aPages[iCurrentIndex]); // Update active slide
                    //   }
                    // }
                    // setInterval(autoSlide, 30000);

                    var oData = {
                        pages: [{
                            pageId: "companyPageId",
                            header: "Company info",
                            title: "Kvriksha Technologies Private Limited",
                            titleUrl: "",
                            icon: "./image/KVPL_logo_T.png",
                            displayShape: "Circle",
                            groups: [{
                                    heading: "Contact Details",
                                    elements: [],
                                },
                                {
                                    heading: "Main Contact",
                                    elements: [{
                                            label: "WhatsApp",
                                            value: "+91 9686145959",
                                            elementType: "pageLink",
                                            pageLinkId: "companyEmployeePageId",
                                        },
                                        {
                                            label: "Email",
                                            value: "accounts@kalpavrikshatechnologies.com",
                                            emailSubject: "Subject",
                                            elementType: "email",
                                        },
                                        {
                                            label: "Address",
                                            value: "#111 Karekal layout , Sharanbasaveshwar Nagar, Near Naganhalli Railway Over Bridge, Gulbarga, Karnataka 585102, IN",
                                            elementType: "text",
                                        },
                                        {
                                            label: "Find Us On Google Map",
                                            value: "Google Map",
                                            elementType: "link",
                                            url: "https://maps.app.goo.gl/zjt8Xy3FsgV13veMA",
                                        },
                                        {
                                            label: "Follow Us On Linked in",
                                            value: "Linked in",
                                            elementType: "link",
                                            url: "https://www.linkedin.com/company/kalpavriksha-technologies/",
                                        },
                                    ],
                                },
                            ],
                        }, ],
                    };
                    var aModel = new JSONModel({
                        ui5topics: [{
                                title: "SAPUI5 Overview",
                                description: "Introduction, Features, MVC"
                            },
                            {
                                title: "Core Concepts",
                                description: "Models, Data Binding, Modules"
                            },
                            {
                                title: "Controls",
                                description: "sap.m, sap.f, Layouts, Tables"
                            },
                            {
                                title: "Fragments & Dialogs",
                                description: "Reusable UI Parts"
                            },
                            {
                                title: "Routing & Navigation",
                                description: "Hash-based routing,Parameter"
                            },
                            {
                                title: "OData & JSON Models",
                                description: "Data handling in SAPUI5"
                            },
                            {
                                title: "UI5 Flexibility",
                                description: "Adaptation, i18n, Themes"
                            },
                            {
                                title: "Events & Lifecycle",
                                description: "onInit, onAfterRendering"
                            },
                            {
                                title: "SAP Fiori Elements",
                                description: "Annotations-driven UI"
                            },
                            {
                                title: "Deployment",
                                description: "SAP BTP, Launchpad, CAPM Repo"
                            }
                        ],
                        CAPMtopics: [{
                                title: "CAPM Overview",
                                description: "Core Data Services, Node.js/Java runtimes"
                            },
                            {
                                title: "Domain Modeling",
                                description: "Entities, Associations, Compositions"
                            },
                            {
                                title: "Service Layer",
                                description: "Exposing services, annotations"
                            },
                            {
                                title: "Persistence",
                                description: "HANA, SQLite, PostgreSQL"
                            },
                            {
                                title: "Authentication & Authorization",
                                description: "XSUAA, Roles, Scopes"
                            },
                            {
                                title: "Events & Messaging",
                                description: "Asynchronous communication"
                            },
                            {
                                title: "CAP with Fiori/UI5",
                                description: "Annotations, UI5 consumption"
                            },
                            {
                                title: "Extensibility",
                                description: "Custom Handlers, Extensions"
                            },
                            {
                                title: "Testing in CAP",
                                description: "Mocha, Jest, Integration tests"
                            },
                            {
                                title: "Deployment",
                                description: "SAP BTP, Multi-Target Apps (MTA)"
                            }

                        ]
                    });
                    this.getView().setModel(aModel, "topicsModel");
                    // TraineeData Model for Training Form
                    const oTData = new JSONModel({
                        Name: "",
                        CollegeName: "",
                        EmailID: "",
                        Course: "",
                        MobileNo: "",
                        Comments: "",
                    });
                    this.getView().setModel(oTData, "TraineeData");

                    var oModel = new JSONModel(oData);
                    this.getView().setModel(oModel);
                },

                onSapui5coursepress: function(oEvent) {
                    this._openCourseDialog("ui5topics", "SAPUI5 Topics");
                },

                onCapmCoursepress: function(oEvent) {
                    this._openCourseDialog("CAPMtopics", "SAP CAPM Topics");
                },

                _openCourseDialog: function(sPath, sTitle) {
                    var that = this;
                    if (!this._pDialog) {
                        sap.ui.core.Fragment.load({
                            id: this.getView().getId(),
                            name: "sap.kt.com.minihrsolution.fragment.CourseDetails",
                            controller: this
                        }).then(function(oDialog) {
                            that.getView().addDependent(oDialog);
                            that._bindTopicsToDialog(oDialog, sPath, sTitle);
                            oDialog.open();
                            that._pDialog = oDialog;
                        });
                    } else {
                        this._bindTopicsToDialog(this._pDialog, sPath, sTitle);
                        this._pDialog.open();
                    }
                },

                _bindTopicsToDialog: function(oDialog, sPath, sTitle) {
                    var oTitle = oDialog.getCustomHeader().getContentMiddle()[0];
                    oTitle.setText(sTitle);
                    oDialog.setTitle(sTitle);

                    var oVBox = sap.ui.core.Fragment.byId(this.getView().getId(), "idVBox");
                    oVBox.removeAllItems();

                    var aTopics = this.getView().getModel("topicsModel").getProperty("/" + sPath);
                    var oTileFlexBox = new sap.m.FlexBox({
                        justifyContent: "Center",
                        alignItems: "Start",
                        wrap: "Wrap",
                        fitContainer: true, // important for responsiveness
                        items: aTopics.map(function(oTopic) {
                            return new sap.m.GenericTile({
                                header: oTopic.title,
                                frameType: "TwoByHalf",
                                size: "Auto",
                                tileContent: [
                                    new sap.m.TileContent({
                                        content: new sap.m.Text({
                                            text: oTopic.description
                                        })
                                    })
                                ]
                            }).addStyleClass("tileMargin customTileBg");
                        })
                    });
                    oTileFlexBox.addStyleClass("tileFlexBoxBg");
                    oVBox.addItem(oTileFlexBox);
                },

                onCloseDialog: function() {
                    this._pDialog.close();
                },

                onTabSelect: function(oEvent) {
                    var oItem = oEvent.getParameter("item");
                    const sKey = oItem.getKey();
                    this.byId("pageContainer").to(this.byId(sKey)); // Switch page

                    // Always scroll to top (first section or top of page)
                    var page = this.byId(sKey);
                    if (page && page.scrollTo) {
                        page.scrollTo(0, 0); // Scroll to very top
                    }

                    // Career section lazy loading
                    if (sKey === "idCareer" && !this._careerDataLoaded) {
                        this._careerDataLoaded = true;
                        this._loadCareerSectionData();
                    }
                },

                _loadCareerSectionData: function() {
                    const oAppConfigModel = new JSONModel({
                        url: "https://rest.kalpavrikshatechnologies.com/",
                        headers: {
                            name: "$2a$12$LC.eHGIEwcbEWhpi9gEA.umh8Psgnlva2aGfFlZLuMtPFjrMDwSui",
                            password: "$2a$12$By8zKifvRcfxTbabZJ5ssOsheOLdAxA2p6/pdaNvv1xy1aHucPm0u",
                        },
                    });
                    this.getOwnerComponent().setModel(oAppConfigModel, "AppConfigModel");
                    const oExpYears = new JSONModel();
                    oExpYears.loadData("model/ExpYears.json", null, false);
                    this.getView().setModel(oExpYears, "ExpYears");
                    const oView = this.getView();
                    $.ajax({
                        url: "https://rest.kalpavrikshatechnologies.com/JobOpenings",
                        type: "GET",
                        contentType: "application/json",
                        dataType: "json",
                        headers: {
                            name: "$2a$12$LC.eHGIEwcbEWhpi9gEA.umh8Psgnlva2aGfFlZLuMtPFjrMDwSui",
                            password: "$2a$12$By8zKifvRcfxTbabZJ5ssOsheOLdAxA2p6/pdaNvv1xy1aHucPm0u",
                        },
                        success: function(response) {
                            const allCandidates = response?.data || [];
                            const activeCandidates = allCandidates.filter((candidate) => candidate.Status === "true");
                            const oModel = new JSONModel({
                                Candidates: activeCandidates
                            });
                            oView.setModel(oModel, "JobApplicationModel");
                            this._loadComboBoxModels(activeCandidates, oView);
                        }.bind(this),
                        error: function(error) {
                            const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
                            const fallbackMessage = oResourceBundle.getText("V1_m_errFetchD");
                            const errorMessage = error?.responseJSON?.message || fallbackMessage;
                            MessageToast.show("Error: " + errorMessage);
                        }.bind(this),
                    });
                },

                onpressLogin: function() {
                    //sap.m.URLHelper.redirect("https://www.kalpavrikshatechnologies.com/EmployeeLogin", true);
                    this.getRouter().navTo("RouteLoginPage");
                },

                //linkdin link
                onClicklinkdin: function() {
                    sap.m.URLHelper.redirect(
                        "https://www.linkedin.com/company/kalpavriksha-technologies/",
                        true
                    );
                },

                //Address link
                onPressAddress: function() {
                    sap.m.URLHelper.redirect(
                        "https://www.google.com/maps/dir/17.3390052,76.8399401/kalpavriksha+technologies/@17.3190648,76.8242773,14z/data=!3m1!4b1!4m9!4m8!1m1!4e1!1m5!1m1!1s0x3bc8c122d9181afd:0x6af9e90eb1f5fc8f!2m2!1d76.8487474!2d17.299382?entry=ttu",
                        true
                    );
                },

                //navigate to home page
                onpressHome: function() {
                    this.getRouter().navTo("RouteHomePage");
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
                ValidateCommonFields: function(oEvent) {
                    utils._LCvalidateMandatoryField(oEvent);
                },
                ValidateSTDFields: function(oEvent) {
                    utils._LCstrictValidationComboBox(oEvent);
                },

                onUI5ress: function() {
                    this.selectedCourse = "SAP UI5"; // Set selected course
                    var oView = this.getView();
                    if (!this.oDialog) {
                        sap.ui.core.Fragment.load({
                            name: "sap.kt.com.minihrsolution.fragment.TraningForm",
                            controller: this,
                        }).then(
                            function(oDialog) {
                                this.oDialog = oDialog;
                                oView.addDependent(this.oDialog);
                                this.oDialog.open();
                            }.bind(this)
                        );
                    } else {
                        this.oDialog.open();
                    }
                },

                onCapmpress: function() {
                    this.selectedCourse = "CAPM"; // Set selected course
                    var oView = this.getView();
                    if (!this.oDialog) {
                        sap.ui.core.Fragment.load({
                            name: "sap.kt.com.minihrsolution.fragment.TraningForm",
                            controller: this,
                        }).then(
                            function(oDialog) {
                                this.oDialog = oDialog;
                                oView.addDependent(this.oDialog);
                                this.oDialog.open();
                            }.bind(this)
                        );
                    } else {
                        this.oDialog.open();
                    }
                },

                FTF_onlivename: function(oEvent) {
                    utils._LCvalidateName(oEvent);
                },
                FTF_onliveclg: function(oEvent) {
                    utils._LCvalidateMandatoryField(oEvent);
                },
                FTF_onlivemail: function(oEvent) {
                    utils._LCvalidateEmail(oEvent);
                },
                FTF_onlivemobile: function(oEvent) {
                    utils._LCvalidateMobileNumber(oEvent);
                },
                FTF_onlivecomment: function(oEvent) {
                    utils._LCvalidateMandatoryField(oEvent);
                },

                FTF_onSubmitForm: function() {
                    var oModel = this.getView().getModel("TraineeData");
                    if (!oModel) {
                        MessageToast.show("Form model not found. Please refresh the page.");
                        return;
                    }
                    var oData = JSON.parse(JSON.stringify(oModel.getData()));
                    oData.Course = this.selectedCourse || ""; // Add selected course
                    var that = this;
                    if (
                        utils._LCvalidateName(sap.ui.getCore().byId("FTF_idName"), "ID") &&
                        utils._LCvalidateMandatoryField(sap.ui.getCore().byId("FTF_idClgname"), "ID") &&
                        utils._LCvalidateEmail(sap.ui.getCore().byId("FTF_idmail"), "ID") &&
                        utils._LCvalidateMobileNumber(sap.ui.getCore().byId("FTF_idMobnumber"), "ID") &&
                        utils._LCvalidateMandatoryField(sap.ui.getCore().byId("FTF_idcomments"), "ID")
                    ) {
                        $.ajax({
                            url: this.API + "/Training",
                            type: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                name: "$2a$12$LC.eHGIEwcbEWhpi9gEA.umh8Psgnlva2aGfFlZLuMtPFjrMDwSui",
                                password: "$2a$12$By8zKifvRcfxTbabZJ5ssOsheOLdAxA2p6/pdaNvv1xy1aHucPm0u"
                            },
                            data: JSON.stringify({
                                data: oData
                            }),
                            success: function(response) {
                                var resetData = {
                                    Name: "",
                                    CollegeName: "",
                                    EmailID: "",
                                    MobileNo: "",
                                    Comments: ""
                                };
                                oModel.setData(resetData);
                                oModel.refresh(true);
                                if (that.oDialog) {
                                    that.oDialog.close();
                                }
                                MessageToast.show(that.i18nModel.getText("msgTraineeformSuccess"));
                            },
                            error: function() {
                                MessageToast.show("Error saving data. Please try again.");
                            }
                        });
                    } else {
                        MessageToast.show(that.i18nModel.getText("mandetoryFields"));
                    }
                },

                FTF_onCancelform: function() {
                    var oModel = this.getView().getModel("TraineeData");
                    if (oModel) {
                        // Reset Data Model
                        var resetData = {
                            Name: "",
                            CollegeName: "",
                            EmailID: "",
                            MobileNo: "",
                            Comments: ""
                        };
                        oModel.setData(resetData);
                        oModel.refresh(true);
                    }

                    // Reset Value States for Validation
                    var aFields = [
                        "FTF_idName",
                        "FTF_idClgname",
                        "FTF_idmail",
                        "FTF_idMobnumber",
                        "FTF_idcomments"
                    ];

                    aFields.forEach(function(sFieldId) {
                        var oField = sap.ui.getCore().byId(sFieldId);
                        if (oField) {
                            oField.setValueState("None");
                        }
                    });

                    // Close the Dialog safely
                    if (this.oDialog) {
                        this.oDialog.close();
                    }
                },

                _loadComboBoxModels: function(aCandidates, oView) {
                    function getUniqueValuesByKey(key) {
                        var map = {};
                        var result = [];

                        for (var i = 0; i < aCandidates.length; i++) {
                            var val = aCandidates[i][key];
                            if (typeof val === "string") {
                                val = val.trim();
                            }
                            if (val && !map[val]) {
                                result.push({
                                    key: val,
                                });
                                map[val] = true;
                            }
                        }
                        for (var i = 0; i < aCandidates.length; i++) {
                            var val = aCandidates[i][key];
                            if (typeof val === "string") {
                                val = val.trim();
                            }
                            if (val && !map[val]) {
                                result.push({
                                    key: val,
                                });
                                map[val] = true;
                            }
                        }

                        result.sort((a, b) => a.key.localeCompare(b.key));
                        return result;
                    }

                    oView.setModel(
                        new JSONModel(getUniqueValuesByKey("PrimarySkills")),
                        "SkillModel"
                    );
                    oView.setModel(
                        new JSONModel(getUniqueValuesByKey("Location")),
                        "LocationModel"
                    );
                    oView.setModel(
                        new JSONModel(getUniqueValuesByKey("Experience")),
                        "ExpModel"
                    );
                },

                v1_filClear: function() {
                    this.byId("V1_ID_SkillsInput").setValue("");
                    this.byId("V1_ID_LocationComboBox").setSelectedKey("");
                    this.byId("V1_ID_ExpComboBox").setSelectedKey("");
                },

                onSuggestSkills: function(oEvent) {
                    const sValue = oEvent.getParameter("suggestValue")?.toLowerCase() || "";

                    const aTableData =
                        this.getView()
                        .getModel("JobApplicationModel")
                        ?.getProperty("/Candidates") || [];
                    const aActiveJobs = aTableData.filter(job => job?.Status === "true");
                    const aMatchedSkills = aActiveJobs
                        .map(item => item.PrimarySkills?.trim())
                        .filter(Boolean)
                        .flatMap(skillStr => skillStr.split(","))
                        .map(skill => skill.trim())
                        .filter(skill => skill.toLowerCase().includes(sValue));
                    const aUniqueSkills = [...new Set(aMatchedSkills)];
                    const aSuggestionItems = aUniqueSkills.map(skill => ({
                        skill
                    }));
                    const oSuggestModel = new sap.ui.model.json.JSONModel({
                        skills: aSuggestionItems
                    });
                    this.getView().setModel(oSuggestModel, "skillModel");
                },

                onSearch: function(oEvent) {
                    var sQuery = oEvent.getParameter("query") || oEvent.getSource().getValue();
                    var oTable = this.byId("V1_ID_Table");
                    var oBinding = oTable.getBinding("items");

                    if (sQuery && sQuery.length > 0) {
                        var oFilter = new sap.ui.model.Filter({
                            path: "PrimarySkills",
                            operator: sap.ui.model.FilterOperator.Contains,
                            value1: sQuery
                        });
                        oBinding.filter([oFilter]);
                    } else {
                        oBinding.filter([]); // clear filters if empty
                    }
                },

                v1_onViewItem: function(oEvent) {
                    const oSelectedData = oEvent
                        .getSource()
                        .getBindingContext("JobApplicationModel")
                        .getObject();
                    const sJobId = oSelectedData.ID; // Or whatever your unique field is

                    // Set global tab info
                    const oAppStateModel =
                        this.getOwnerComponent().getModel("AppStateModel");
                    if (oAppStateModel) {
                        oAppStateModel.setProperty("/previousTab", "idCareer");
                        // oAppStateModel.setProperty("/previousTab", "idProducts");
                    }
                    // Navigate using the jobId
                    this.getRouter().navTo("RouteJobView", {
                        jobId: sJobId,
                    });
                },

                onOpenForm: function() {
                    if (!this._oDemoFormDialog) {
                        this._oDemoFormDialog = sap.ui.xmlfragment(
                            this.getView().getId(), "sap.kt.com.minihrsolution.fragment.NewDemoform",
                            this
                        );
                        this.getView().addDependent(this._oDemoFormDialog);
                    }
                    this._oDemoFormDialog.open();
                },

                onCloseDemoForm: function() {
                    if (this._oDemoFormDialog) {
                        this._oDemoFormDialog.close();
                    }
                },
                onHRSolutionPress: function() {
                    const oAppStateModel = this.getOwnerComponent().getModel("AppStateModel");   // Set global tab info
                    if (oAppStateModel) {
                        oAppStateModel.setProperty("/previousTab", "idProducts");
                    }
                    this.getRouter().navTo("HRSolutions_Demo");  // Navigate using the jobId
                },
                onInvoiceManagePress: function() {
                    const oAppStateModel = this.getOwnerComponent().getModel("AppStateModel");
                    if (oAppStateModel) {
                        oAppStateModel.setProperty("/previousTab", "idProducts");
                    }
                    this.getRouter().navTo("Invoice_Solution_Demo");
                },
                onAssetPress: function() {
                    const oAppStateModel = this.getOwnerComponent().getModel("AppStateModel");
                    if (oAppStateModel) {
                        oAppStateModel.setProperty("/previousTab", "idProducts");
                    }
                    this.getRouter().navTo("IT_Asset_Demo");
                },
                onrecruitmentPress: function() {
                    const oAppStateModel = this.getOwnerComponent().getModel("AppStateModel");
                    if (oAppStateModel) {
                        oAppStateModel.setProperty("/previousTab", "idProducts");
                    }
                    this.getRouter().navTo("Recruitment_Demo");
                },
                onAutoMotivePress: function() {
                    const oAppStateModel = this.getOwnerComponent().getModel("AppStateModel");
                    if (oAppStateModel) {
                        oAppStateModel.setProperty("/previousTab", "idProducts");
                    }
                    this.getRouter().navTo("AutoMobile_Demo");
                },
                onIdCardPress: function() {
                    const oAppStateModel = this.getOwnerComponent().getModel("AppStateModel");
                    if (oAppStateModel) {
                        oAppStateModel.setProperty("/previousTab", "idProducts");
                    }
                    this.getRouter().navTo("IDCardgenerate");
                },
                onNavToHrSolution: function() {
                    this.getRouter().navTo("HRSolutions_Demo");
                },
                onNavToInvoiceSolution: function() {
                    this.getRouter().navTo("Invoice_Solution_Demo");
                },
                onNavToCompanySolution: function() {
                    this.getRouter().navTo("IT_Asset_Demo");
                },
                onNavToRecruitmentSolution: function() {
                    this.getRouter().navTo("Recruitment_Demo");
                },
                onNavToAutomobileSolution: function() {
                    this.getRouter().navTo("AutoMobile_Demo");
                },
                onOpenjob: function() {
                    this.getRouter().navTo("Job_Details");
                },
              
                onAfterRendering: function() {
                     this._applyResponsiveVideo("videoBoxoffice", "videoFrametour", "../Videos/Office Tour.mp4");
                    this._applyResponsiveVideo("videoFrametour_WorkZone", "videoFrameHtml_WorkZone", "../Videos/Workzone.mp4");
                    this._applyResponsiveVideo("videoFrametour_Customer", "videoFrameHtml_Customer", "../Videos/Kvriksha Customer.mp4");
                    this._applyResponsiveVideo("videoFrametourl_Supplier", "videoFrameHtml_Supplier", "../Videos/Kvriksha Supplier.mp4");
                    this._applyResponsiveVideo("videoBoxOCR", "videoFrametourOCR", "../Videos/KT OCR.mp4");
                    this._applyResponsiveVideo("videoFrametourl_Shah", "videoFrameHtml_Shah", "../Videos/Shah H.mp4");
                },
                _applyResponsiveVideo: function(vBoxId, htmlId, videoUrl) {
                    var oVBox = this.byId(vBoxId);
                    var oHtml = this.byId(htmlId);
                    if (!oVBox || !oHtml) return;
                    var bAutoplay = (vBoxId === "videoBoxoffice");
                    // Video tag
                    var sVideoTag = "<video id='" + htmlId + "_video' controls " +
                        (bAutoplay ? "autoplay muted playsinline" : "") +
                        ">" +
                        "<source src='" + videoUrl + "' type='video/mp4'>" +
                        "</video>";
                    // Always wrap in responsive container
                    var sWrapper = "<div class='video-responsive'>" + sVideoTag + "</div>";
                    oHtml.setContent(sWrapper);
                    // Adjust object-fit dynamically if needed
                    setTimeout(function() {
                        var videoEl = document.getElementById(htmlId + "_video");
                        if (videoEl) {
                            videoEl.addEventListener("loadedmetadata", function() {
                                var vidRatio = videoEl.videoWidth / videoEl.videoHeight;
                                var boxRatio = 16 / 9;

                                if (Math.abs(vidRatio - boxRatio) < 0.1) {
                                    videoEl.style.objectFit = "cover"; // typical 16:9 video
                                } else {
                                    videoEl.style.objectFit = "contain"; // show full video with background
                                }
                            });
                        }
                     }, 200);
                }
            }
        );
    }
);