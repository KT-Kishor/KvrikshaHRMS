sap.ui.define(["./BaseController", "sap/ui/model/json/JSONModel"], function(BaseController, JSONModel) {
    "use strict";
    return BaseController.extend("sap.kt.com.minihrsolution.controller.HiringDashboard", {
        onInit: function() {
            this.getRouter().getRoute("RouteHiringDashboard").attachMatched(this._onRouteMatched, this);
        },
    _onRouteMatched: async function() {
    this.getBusyDialog();
    this._tableReadyToClose = false; // reset flag
    try {
        var LoginFunction = await this.commonLoginFunction("Expense");
        if (!LoginFunction) {
            this.closeBusyDialog();
            return;
        }

        this.i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle();
this.getBusyDialog();
        var response = await this.ajaxReadWithJQuery("Candidate");
        var candidates = response?.data || [];

        candidates = candidates.map(item => ({
            ...item,
            Photo: item.Photo ? "data:image/jpeg;base64," + item.Photo : ""
        }));

        this.getView().getModel("LoginModel").setProperty("/HeaderName", "Campus Hiring Dashboard");

        // Reset filter state
        this._filterState = { name: "", skill: "", lang: "" };

        // Reset UI controls
        var oNameInput = this.byId("nameInput");
        var oSkillSelect = this.byId("skillSelect");
        var oLangSelect = this.byId("langSelect");
        if (oNameInput)   oNameInput.setValue("");
        if (oSkillSelect) oSkillSelect.setSelectedKey("");
        if (oLangSelect)  oLangSelect.setSelectedKey("");

        // Attach listener BEFORE setting model. We use a normal (repeatable)
        // listener instead of attachEventOnce, because sap.m.Table with
        // growing="true" can fire updateFinished MULTIPLE times (reason:
        // "Change", "Growing", "Filter", etc). The first firing is not
        // guaranteed to be the one where rows are actually rendered.
        var oTable = this.byId("candidateTable");
        if (oTable) {
            oTable.detachUpdateFinished(this._onTableUpdateFinished, this);
            oTable.attachUpdateFinished(this._onTableUpdateFinished, this);
        }

        // Set the flag — any updateFinished AFTER this line should be considered
        this._tableReadyToClose = true;

        // NOW set the model (triggers binding refresh → updateFinished)
        var oModel = new JSONModel({ candidates: candidates });
        this.getView().setModel(oModel, "candidateModel");
        this._oOriginalData = candidates;

        // Safety fallback: if no data, close immediately (no rows = no updateFinished)
        if (!candidates.length) {
            this._tableReadyToClose = false;
            if (oTable) {
                oTable.detachUpdateFinished(this._onTableUpdateFinished, this);
            }
            this.closeBusyDialog();
        }

    } catch (e) {
        console.error("Candidate API Error:", e);
        this.closeBusyDialog();
    }
},

_onTableUpdateFinished: function() {
    // Only act if we're in the "waiting to close" window
    if (!this._tableReadyToClose) {
        return;
    }

    var oTable = this.byId("candidateTable");

    // IMPORTANT: don't trust the event itself — verify the table has
    // actually rendered rows (or genuinely has none) before closing.
    // With growing="true", updateFinished can fire before all rows
    // are in the DOM, so we check the real item count.
    var iItems = oTable ? oTable.getItems().length : 0;
    var iBindingLength = oTable && oTable.getBinding("items")
        ? oTable.getBinding("items").getLength()
        : 0;

    // If the binding has data but the table hasn't rendered any items yet,
    // this firing is premature — wait for the next updateFinished instead.
    if (iBindingLength > 0 && iItems === 0) {
        return;
    }

    // We're done — detach so growing/scroll-triggered updates later
    // (loading more pages, filtering, etc.) don't re-trigger this logic.
    this._tableReadyToClose = false;
    if (oTable) {
        oTable.detachUpdateFinished(this._onTableUpdateFinished, this);
    }

    sap.ui.getCore().applyChanges();

    // Wait two animation frames to guarantee the browser has actually
    // painted the rows before hiding the busy dialog (avoids any
    // "No data" flash, e.g. while avatar images are still decoding).
    requestAnimationFrame(function () {
        requestAnimationFrame(function () {
            this.closeBusyDialog();
        }.bind(this));
    }.bind(this));
},
        onGoToDashboard: function() {
            this.getRouter().navTo("RouteHiringDashboardOverview");
        },
        onPressback: function() {
            this.getRouter().navTo("RouteTilePage");
        },
        onLogout: function() {
            this.CommonLogoutFunction();
        },
        onLiveSearch: function(oEvent) {
            var sValue = oEvent.getParameter("value") || "";
            this._filterState.name = sValue.toLowerCase();
            this._applyFilters();
        },
        onFilterChange: function() {
            this._filterState.skill = this.byId("skillSelect").getSelectedKey();
            this._filterState.lang = this.byId("langSelect").getSelectedKey();
        },
        onFilterSearch: function() {
            this._applyFilters();
        },
        _applyFilters: function() {
            var aData = this._oOriginalData || [];
            var name = this._filterState.name;
            var skill = this._filterState.skill;
            var lang = this._filterState.lang;
            var aFiltered = aData.filter(item => {
                var bName = !name || (item.candidate_Name || "").toLowerCase().includes(name);
                var bSkill = !skill || item.skill_level === skill;
                var bLang = !lang || item.preferred_language === lang;
                return bName && bSkill && bLang;
            });
            // SORT A-Z
            aFiltered.sort((a, b) => (a.candidate_Name || "").localeCompare(b.candidate_Name || ""));
            this.getView().getModel("candidateModel").setProperty("/candidates", aFiltered);
        },
        onFilterClear: function() {
            // RESET UI FIELDS
            this.byId("nameInput").setValue("");
            this.byId("skillSelect").setSelectedKey("");
            this.byId("langSelect").setSelectedKey("");
            // RESET STATE
            this._filterState = {
                name: "",
                skill: "",
                lang: ""
            };
        }
    });
});