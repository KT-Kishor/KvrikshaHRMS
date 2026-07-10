sap.ui.define(["./BaseController", "sap/ui/model/json/JSONModel","sap/ui/model/Filter","sap/ui/model/FilterOperator"], function (BaseController, JSONModel, Filter, FilterOperator) {
    "use strict";
    return BaseController.extend("sap.kt.com.minihrsolution.controller.HiringDashboard", {

        onInit: function () {
            this.getRouter()
                .getRoute("RouteHiringDashboard")
                .attachMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: async function () {
            this.getBusyDialog();
            try {
                var LoginFunction = await this.commonLoginFunction("Expense");
                if (!LoginFunction) {
                    this.closeBusyDialog();
                    return;
                }

                this.i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle();
                this.getView().getModel("LoginModel").setProperty("/HeaderName", "Campus Hiring Dashboard");

                // ---- Reset pagination state ----
                this._top = 10;            // real page size
                this._skip = 0;
                this._loading = false;
                this._allLoaded = false;
                this._oOriginalData = [];

                // ---- Reset filters ----
                this._filterState = { name: "", skill: "", lang: "" };
                var oNameInput = this.byId("nameInput");
                var oSkillSelect = this.byId("skillSelect");
                var oLangSelect = this.byId("langSelect");
                if (oNameInput) oNameInput.setValue("");
                if (oSkillSelect) oSkillSelect.setSelectedKey("");
                if (oLangSelect) oLangSelect.setSelectedKey("");

                // Fresh model before first page loads
                var oModel = new JSONModel({ candidates: [], totalLoaded: 0 });
                oModel.setSizeLimit(10000);
                this.getView().setModel(oModel, "candidateModel");

                 var oViewModel = new JSONModel({
                   candidateCount: 0
                  });
                 this.getView().setModel(oViewModel, "viewModel");
                // Load page 1 (skip=0)
                await this._loadPage();

            } catch (e) {
                console.error("Candidate API Error:", e);
            } finally {
                this.closeBusyDialog();
            }
        },

        _loadPage: async function () {

    if (this._loading || this._allLoaded) {
        return;
    }

    this._loading = true;

    this.getBusyDialog();

    try {

        var iFetchCount = this._top + 1;

        // Endpoint only
        var sUrl = "Candidate";

        // Query parameters
        var oFilter = {
            top: iFetchCount,
            skip: this._skip
        };

        if (this._filterState.skill) {
            oFilter.skill_level = this._filterState.skill;
        }

        if (this._filterState.lang) {
            oFilter.preferred_language = this._filterState.lang;
        }

        console.log("URL:", sUrl);
        console.log("Filter:", oFilter);

        var response = await this.ajaxReadWithJQuery(sUrl, oFilter);

        var oModel = this.getView().getModel("candidateModel");
        var oViewModel = this.getView().getModel("viewModel");

        // Store total candidate count
        if (response.pagination) {
            oModel.setProperty("/totalCandidates", response.pagination.total);
            oViewModel.setProperty("/candidateCount", response.pagination.total);
        }

        var aData = response.data || [];

        // Check whether next page exists
        var bHasMore = aData.length > this._top;

        // Keep only actual page size
        var aPageData = bHasMore ? aData.slice(0, this._top) : aData;

        // Convert image
        aPageData = aPageData.map(function (item) {
            item.Photo = item.Photo
                ? "data:image/jpeg;base64," + item.Photo
                : "";
            return item;
        });

        // Update skip
        this._skip += aPageData.length;

        // Update last page flag
        this._allLoaded = !bHasMore;

        // Keep original loaded data
        this._oOriginalData = (this._oOriginalData || []).concat(aPageData);

        var aExisting = (oModel.getProperty("/candidates") || []).filter(function (item) {
            return !item.__placeholder;
        });

        var aDisplayData = aExisting.concat(aPageData);

        // Add placeholder only if more records exist
        if (bHasMore) {
            aDisplayData.push(this._createPlaceholder());
        }

        // Update model
        oModel.setProperty("/candidates", aDisplayData);
        oViewModel.setProperty("/candidateCount", aDisplayData.length);
        oModel.setProperty("/totalLoaded", this._oOriginalData.length);

    } catch (e) {

        console.error("Load Candidates Error:", e);

    } finally {

        this.closeBusyDialog();
        this._loading = false;

    }
},
        _createPlaceholder: function () {
            return {
                id: "",
                candidate_Name: "",
                candidate_Email: "",
                skill_level: "",
                preferred_language: "",
                Photo: "",
                __placeholder: true
            };
        },

        // Fires on EVERY table refresh (initial set, filter, sort, growing).
        // We only react when the user actually pressed the "More" trigger.
        onUpdateFinished: function (oEvent) {
            var sReason = oEvent.getParameter("reason");
            if (sReason !== "Growing") {
                return;
            }
            if (this._loading || this._allLoaded) {
                return;
            }
            this._loadPage();
        },

        onGoToDashboard: function () {
            this.getRouter().navTo("RouteHiringDashboardOverview");
        },
        onPressback: function () {
            this.getRouter().navTo("RouteTilePage");
        },
        onLogout: function () {
            this.CommonLogoutFunction();
        },
 onLiveSearch: function (oEvent) {
    var sValue = oEvent.getParameter("value");
    var oTable = this.byId("candidateTable");
    var oBinding = oTable.getBinding("items");

    if (!sValue) {
        oBinding.filter([]);
    } else {
        var aFilters = [
            new Filter("student_Id", FilterOperator.Contains, sValue),
            new Filter("candidate_Name", FilterOperator.Contains, sValue),
            new Filter("candidate_Email", FilterOperator.Contains, sValue),
            new Filter("skill_level", FilterOperator.Contains, sValue),
            new Filter("preferred_language", FilterOperator.Contains, sValue),
            new Filter("Status", FilterOperator.Contains, sValue)
        ];

        oBinding.filter(new sap.ui.model.Filter({
            filters: aFilters,
            and: false
        }));
    }

    // Update count
    this.getView().getModel("viewModel")
        .setProperty("/candidateCount", oBinding.getLength());
},
        onFilterChange: function () {
            this._filterState.skill = this.byId("skillSelect").getSelectedKey();
            this._filterState.lang = this.byId("langSelect").getSelectedKey();
        },
        onFilterSearch: function () {
    this._skip = 0;
    this._allLoaded = false;
    this._oOriginalData = [];

    this.getView().getModel("candidateModel").setProperty("/candidates", []);

    this._loadPage();
},
        // NOTE: this filters only rows already loaded into the browser
        // (this._oOriginalData). Pages not fetched yet are not included.
        // For filtering across ALL candidates, send name/skill/lang to the
        // backend as query params instead — say the word and I'll wire that up.
        // _applyFilters: function () {
        //     var aData = this._oOriginalData || [];
        //     var skill = this._filterState.skill;
        //     var lang = this._filterState.lang;
        //     var aFiltered = aData.filter(function (item) {
              
        //         var bSkill = !skill || item.skill_level === skill;
        //         var bLang = !lang || item.preferred_language === lang;
        //         return bSkill && bLang;
        //     });
        //     this.getView().getModel("candidateModel").setProperty("/candidates", aFiltered);
        //     this.getView().getModel("viewModel").setProperty("/candidateCount", aFiltered.length);
        // },
        onFilterClear: function () {
            this.byId("nameInput").setValue("");
            this.byId("skillSelect").setSelectedKey("");
            this.byId("langSelect").setSelectedKey("");
            this._filterState = { name: "", skill: "", lang: "" };

            // Restore the full loaded (unfiltered) set, re-adding the
            // placeholder if more server pages are still available
            // var oModel = this.getView().getModel("candidateModel");
            // var aData = (this._oOriginalData || []).slice();
            // if (!this._allLoaded) {
            //     aData.push(this._createPlaceholder());
            // }
            // oModel.setProperty("/candidates", aData);
        }
    });
});