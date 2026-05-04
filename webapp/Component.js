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
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // set the device model
            this.setModel(models.createDeviceModel(), "device");

            // fetch common master data only once
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
            // this._fetchCommonData("PaymentTerms", "ContractpaymentModel");
           
           
            const oAppStateModel = new sap.ui.model.json.JSONModel({
              previousTab: "idHome", // default value
            });
            this.setModel(oAppStateModel, "AppStateModel");


            // enable routing
            this.getRouter().initialize();

             // one-liner: apply the global no-spacer patch + bottom padding
            LayoutPatches.applyNoSpacerPatch({
            appRootId: "container-sap.kt.com.minihrsolution---App",
            paddingPx: 20, // tweak if you want more/less breathing room
            observe: true, // keep fixing after re-renders
            });
        },

        _fetchCommonData: async function (entityName, modelName, filter = "") {
            // If already loaded, skip
            if (this.getModel(modelName)) return;

            const url =  "https://rest.kalpavrikshatechnologies.com/" + entityName;
            const headers = {
              name: "$2a$12$LC.eHGIEwcbEWhpi9gEA.umh8Psgnlva2aGfFlZLuMtPFjrMDwSui",
              password:
                "$2a$12$By8zKifvRcfxTbabZJ5ssOsheOLdAxA2p6/pdaNvv1xy1aHucPm0u",
              "Content-Type": "application/json",
            } ;

            try {
                const result = await new Promise((resolve, reject) => {
                    $.ajax({
                        url: url,
                        method: "GET",
                        headers: headers,
                        data: filter,
                        success: function (data) {
                            resolve(data);
                        },
                        error: function (err) {
                            reject(err);
                        }
                    });
                });

                if (result && result.data) {
                    const oModel = new JSONModel(result.data);
                    this.setModel(oModel, modelName);
                }
            } catch (error) {
                MessageToast.show(error?.responseJSON?.message || "Error loading " + entityName);
            }
        }
    });
});
