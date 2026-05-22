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

                this._fetchCommonData("CompanyCodeDetails", "CompanyCodeDetailsModel", {});
                this._fetchCommonData("AppVisibility", "RoleModel");
                this._fetchCommonData("Country", "CountryModel");
                this._fetchCommonData("State", "StateModel");
                this._fetchCommonData("City", "CityModel");
                this._fetchCommonData("Currency", "CurrencyModel");
                this._fetchCommonData("EmployeeDetailsData", "empModel");
                this._fetchCommonData("Designation", "DesignationModel");
                this._fetchCommonData("Department", "DepartmentModel");
                this._fetchCommonData("BaseLocation", "BaseLocationModel");
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

            if (!sessionStorage.getItem("tabId")) {
                sessionStorage.setItem("tabId", Date.now().toString());
            }

            this._registerTab();

            window.addEventListener("beforeunload", this._removeTab.bind(this));

            window.addEventListener("storage", this._onStorageChange.bind(this));
        },

        _registerTab: function () {

    const tabId = sessionStorage.getItem(
        "tabId"
    );

    // Always get latest tabs
    let tabs = JSON.parse(
        localStorage.getItem("activeTabs") || "[]"
    );

    // Remove duplicates
    tabs = tabs.filter(id => id);

    // Add only if not exists
    if (!tabs.includes(tabId)) {
        tabs.push(tabId);
    }

    // Save latest
    localStorage.setItem(
        "activeTabs",
        JSON.stringify(tabs)
    );

    console.log(
        "REGISTER TAB:",
        tabs
    );
},

        _removeTab: function () {

    const tabId = sessionStorage.getItem(
        "tabId"
    );

    let tabs = JSON.parse(
        localStorage.getItem("activeTabs") || "[]"
    );

    tabs = tabs.filter(
        id => id !== tabId
    );

    localStorage.setItem(
        "activeTabs",
        JSON.stringify(tabs)
    );

    console.log(
        "REMOVE TAB:",
        tabs
    );

    sessionStorage.removeItem("tabId");

    setTimeout(() => {

        const latestTabs = JSON.parse(
            localStorage.getItem("activeTabs") || "[]"
        );

        if (latestTabs.length === 0) {

            localStorage.removeItem(
                "isLoggedIn"
            );

            localStorage.removeItem(
                "_x9A1p"
            );

            localStorage.removeItem(
                "_k7LmQ"
            );

            localStorage.removeItem(
                "_aB39X"
            );

            localStorage.removeItem(
                "_mN72P"
            );

            localStorage.removeItem(
                "activeTabs"
            );
        }

    }, 1000);
},

        _onStorageChange: function (event) {

            const aProtectedKeys = ["_x9A1p","_k7LmQ","_aB39X","_mN72P"];

            // Ignore tab handling keys
            if ( event.key === "activeTabs" || event.key === "tabId") {
                return;
            }

            // Ignore unrelated keys
            if (!aProtectedKeys.includes(event.key)) {
                return;
            }

            // Ignore first login set
            if (event.oldValue === null) {
                return;
            }

            // Ignore app updates
            if (window._isAppUpdatingStorage) {
                return;
            }

            // Prevent multiple trigger
            if (window._sessionLogoutRunning) {
                return;
            }

            window._sessionLogoutRunning = true;

            MessageToast.show("Session Modified");

            // Remove only login keys
            localStorage.removeItem("isLoggedIn");

            localStorage.removeItem("_x9A1p");
            localStorage.removeItem("_k7LmQ");

            localStorage.removeItem("_aB39X");
            localStorage.removeItem("_mN72P");

            // DO NOT REMOVE
            // activeTabs
            // tabId

            this.getRouter().navTo("RouteLoginPage");
        },

        // =========================
        // LOGIN DATA
        // =========================
        // CommonReadCall: async function () {

        //     try {
        //         const result = await this._fetchCommonData("LoginDetails", {
        //             EmployeeID: localStorage.getItem("EmployeeID"),
        //             EmployeeName: localStorage.getItem("EmployeeName")
        //         });

        //         if (!result || !result.data || result.data.length === 0) {

        //             localStorage.removeItem("isLoggedIn");
        //             return;
        //         }

        //         const userData = result.data;

        //         let oLoginModel = this.getModel("LoginModel");

        //         if (!oLoginModel) {
        //             oLoginModel = new JSONModel({});
        //             this.setModel(oLoginModel, "LoginModel");
        //         }

        //         oLoginModel.setProperty("/EmployeeID", userData.EmployeeID);
        //         oLoginModel.setProperty("/EmployeeName", userData.EmployeeName);
        //         oLoginModel.setProperty("/EmailID", userData.EmailID);
        //         oLoginModel.setProperty("/Role", userData.Role);
        //         oLoginModel.setProperty("/FolderID", userData.FolderID);
        //         oLoginModel.setProperty("/CompanyCode", userData.CompanyCode);

        //         setTimeout(() => {
        //             // Current URL hash
        //             let sHash = window.location.hash;
        //             // Remove #/
        //             sHash = sHash.replace(/^#\//, "");
        //             if(sHash === "" || sHash === "TilePage") {
        //                 this.getRouter().navTo("RouteTilePage");
        //             }
        //         }, 0);

        //     } catch (error) {
        //         localStorage.removeItem("isLoggedIn");
        //     }
        // },

        // =========================
        // API CALL
        // =========================
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