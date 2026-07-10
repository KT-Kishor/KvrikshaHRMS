sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/kt/com/minihrsolution/model/models",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/kt/com/minihrsolution/utils/LayoutPatches"
], (UIComponent, models, JSONModel, MessageToast, LayoutPatches) => {
    "use strict";

    return UIComponent.extend("sap.kt.com.minihrsolution.Component", {

        metadata: {
            manifest: "json",
            interfaces: ["sap.ui.core.IAsyncContentCreation"]
        },

        // =========================
        // INIT
        // =========================
        init() {

            UIComponent.prototype.init.apply(this, arguments);

            this._initTabSession();

            this.setModel(models.createDeviceModel(), "device");

            this.getRouter().initialize();

            this.getRouter().attachRouteMatched(this._onRouteMatched, this);
            // =========================
            // MASTER DATA (SAFE LOAD)
            // =========================
            if (!this._masterDataLoaded) {
                this._masterDataLoaded = true;

                this._fetchCommonData("CompanyCodeDetails", "CompanyCodeDetailsModel");
                this._fetchCommonData("AppVisibility", "RoleModel");
                this._fetchCommonData("Country", "CountryModel");
                this._fetchCommonData("State", "StateModel");
                this._fetchCommonData("City", "CityModel");
                this._fetchCommonData("Currency", "CurrencyModel");
                this._fetchCommonData("EmployeeDetailsData", "empModel");
                this._fetchCommonData("Designation", "DesignationModel");
                this._fetchCommonData("Department", "DepartmentModel");
                this._fetchCommonData("BaseLocation", "BaseLocationModel");
                this._fetchCommonData("Role_Department", "RoleDepartmentModel");
            }

            this.setModel(new JSONModel({
                previousTab: "idHome"
            }), "AppStateModel");

            LayoutPatches.applyNoSpacerPatch({
                appRootId: "container-sap.kt.com.minihrsolution---App",
                paddingPx: 20,
                observe: true,
            });
        },

        // =========================
        // ROUTE CHECK (LOGIN SAFE)
        // =========================
        _onRouteMatched: function () {

            // const isLoggedIn = localStorage.getItem("isLoggedIn");

            // if (isLoggedIn === "true") {
            //     if (!this._loginLoaded) {
            //         this._loginLoaded = true;
            //         this.CommonReadCall();
            //     }
            // }
        },

        // =========================
        // TAB SESSION MANAGEMENT
        // =========================
        _initTabSession: function () {
            // 1. Generate a unique ID for this tab instance for this session only
            if (!sessionStorage.getItem("tabId")) {
                let activeTabs = JSON.parse(localStorage.getItem("activeTabs") || "[]");
                if (activeTabs.length === 0) {
                    localStorage.removeItem("isLoggedIn");
                    localStorage.removeItem("_x9A1p");
                    localStorage.removeItem("_k7LmQ");
                    localStorage.removeItem("_aB39X");
                    localStorage.removeItem("_mN72P");
                    localStorage.removeItem("activeTabs");
                    sessionStorage.setItem("tabId", Date.now().toString() + "_" + Math.random());
                }
            }
            this._tabId = sessionStorage.getItem("tabId");

            // 2. Register this tab in localStorage
            this._registerTab();

            // 3. Attach standard listeners
            window.addEventListener("beforeunload", this._removeTab.bind(this));
            window.addEventListener("storage", this._onStorageChange.bind(this));
        },

        _registerTab: function () {
            let tabs = JSON.parse(localStorage.getItem("activeTabs") || "[]");

            // Clean out any null/undefined values
            tabs = tabs.filter(id => id);

            // Add this tab if it isn't already tracked
            if (!tabs.includes(this._tabId)) {
                tabs.push(this._tabId);
            }

            localStorage.setItem("activeTabs", JSON.stringify(tabs));
        },

        _removeTab: function () {
            let tabs = JSON.parse(localStorage.getItem("activeTabs") || "[]");

            // Immediately remove this tab from the active list
            tabs = tabs.filter(id => id !== this._tabId);
            localStorage.setItem("activeTabs", JSON.stringify(tabs));

            setTimeout(() => {
                const latestTabs = JSON.parse(localStorage.getItem("activeTabs") || "[]");

                // Only clear data if absolutely NO tabs are open anymore
                if (latestTabs.length === 0) {
                    localStorage.removeItem("isLoggedIn");
                    localStorage.removeItem("_x9A1p");
                    localStorage.removeItem("_k7LmQ");
                    localStorage.removeItem("_aB39X");
                    localStorage.removeItem("_mN72P");
                    localStorage.removeItem("activeTabs");
                }
            }, 1500);
        },

        _onStorageChange: function (event) {
            const aProtectedKeys = ["_x9A1p", "_k7LmQ", "_aB39X", "_mN72P"];
            // Ignore tab handling keys
            if (event.key === "activeTabs" || event.key === "tabId") return;
            // Ignore unrelated keys
            if (!aProtectedKeys.includes(event.key)) return;

            // Ignore first login set
            if (event.oldValue === null) return;

            // Ignore app updates
            if (window._isAppUpdatingStorage) return;
            // Prevent multiple trigger
            if (window._sessionLogoutRunning) return;

            window._sessionLogoutRunning = true;
            // Remove only login keys
            localStorage.removeItem("isLoggedIn");
            localStorage.removeItem("_x9A1p");
            localStorage.removeItem("_k7LmQ");
            localStorage.removeItem("_aB39X");
            localStorage.removeItem("_mN72P");

            this.getRouter().navTo("RouteHostel");
        },

        _fetchCommonData: async function (entityName, modelName, filter = "") {

            if (this.getModel(modelName)) return;

            const url = "https://rest.kalpavrikshatechnologies.com/" + entityName;

            const headers = {
                name: "$2a$12$LC.eHGIEwcbEWhpi9gEA.umh8Psgnlva2aGfFlZLuMtPFjrMDwSui",
                password: "$2a$12$By8zKifvRcfxTbabZJ5ssOsheOLdAxA2p6/pdaNvv1xy1aHucPm0u",
                "Content-Type": "application/json",
            };

            try {
                const result = await new Promise((resolve, reject) => {
                    $.ajax({
                        url,
                        method: "GET",
                        headers,
                        data: filter,
                        success: resolve,
                        error: reject
                    });
                });

                if (result && result.data) {
                    this.setModel(new JSONModel(result.data), modelName);
                }

                return result;

            } catch (error) {
                MessageToast.show("Error loading " + entityName);
            }
        }
    });
});