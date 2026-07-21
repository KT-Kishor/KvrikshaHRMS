sap.ui.define(
    ["./BaseController", "sap/ui/model/json/JSONModel", "sap/ui/core/Fragment", "sap/m/MessageBox", "sap/m/MessageToast", "../utils/validation", "../model/formatter",],
    function (BaseController, JSONModel, Fragment, MessageBox, MessageToast, Validation, formatter) {
        "use strict";
        return BaseController.extend("sap.kt.com.minihrsolution.controller.Policy", {
            Formatter: formatter,
            onInit: function () {
                this.getRouter().getRoute("RoutePolicy").attachMatched(this.PL_onRouteMatched, this);
                this._employeeCache = null;
                this._employeePromise = null;
                this.getView().setModel(new JSONModel([]), "FilteredRoleModel");
                //  MODEL FOR DATE PICKER MIN DATE
                const oFY = this._getFinancialYearRange();
                this.getView().setModel(new JSONModel({
                    today: new Date(),
                    minDate: oFY.startDate,
                    maxDate: oFY.endDate
                }), "todayModel");
                // SAFE LOGIN MODEL CHECK
                var oLoginModel = this.getView().getModel("LoginModel");
                var sRole = "";
                if (oLoginModel) {
                    sRole = (oLoginModel.getProperty("/Role") || "").toLowerCase();
                }
                var bShowAdminControls = sRole === "admin" || sRole === "hr manager";
                this.getView().setModel(new JSONModel({
                    showAdminControls: bShowAdminControls
                }), "visibilityModel");
            },
            _applyStartDateStyle: function () {
                const oView = this.getView();
                if (!oView) return;
                const oModel = oView.getModel("VisibleModel");
                if (!oModel) return;
                const bEdit = oModel.getProperty("/EditBtn");
                const oLabel = this.byId("PL_id_StartDateLabel");
                const oText = this.byId("PL_id_StartDateText");
                if (!oLabel || !oText) return;
                if (bEdit) {
                    oLabel.removeStyleClass("sapUiTinyMarginTop");
                    oText.removeStyleClass("sapUiTinyMarginTop");
                } else {
                    oLabel.addStyleClass("sapUiTinyMarginTop");
                    oText.addStyleClass("sapUiTinyMarginTop");
                }
            },
            _getEmployeeDetails: async function () {
                if (this._employeeCache) {
                    return this._employeeCache;
                }
                if (this._employeePromise) {
                    return this._employeePromise;
                }
                const oLoginModel = this.getView().getModel("LoginModel");
                const sEmployeeID = oLoginModel.getProperty("/EmployeeID");

                this._employeePromise = this.ajaxReadWithJQuery("EmployeeDetails", {
                    EmployeeID: sEmployeeID
                }).then((oResponse) => {
                    let sDepartment = "";
                    let sRole = "";
                    if (oResponse && oResponse.success && oResponse.data && oResponse.data.length > 0) {
                        const oEmployee = oResponse.data[0];
                        sDepartment = (oEmployee.Department || "").toLowerCase().trim();
                        sRole = (oEmployee.Role || "").toLowerCase().trim();
                    }
                    this._employeeCache = {
                        department: sDepartment,
                        role: sRole
                    };
                    oLoginModel.setProperty("/Department", sDepartment);
                    oLoginModel.setProperty("/Role", sRole);
                    return this._employeeCache;
                }).catch((oError) => {
                    this._employeeCache = {
                        department: "",
                        role: ""
                    };
                    return this._employeeCache;
                }).finally(() => {
                    this._employeePromise = null;
                });
                return this._employeePromise;
            },
            PL_loadRoleDepartment: async function () {
                const oView = this.getView();
                const oLoginModel = oView.getModel("LoginModel");
                const sEmpId = oLoginModel.getProperty("/EmployeeID");
                const oResponse = await this.ajaxReadWithJQuery("Role_Department", {
                    EmpID: sEmpId
                });
                let aData = [];
                if (oResponse && oResponse.success) {
                    aData = oResponse.data.map(function (item) {
                        return {
                            department: item.Department || "",
                            // NEW FIELD
                            role: item.Role || "",
                            // KEEP OLD FIELD FOR EXISTING CODE
                            designationName: item.Role || ""
                        };
                    });
                }
                this.getView().setModel(new JSONModel(aData), "DesignationModel");
                const oDepartmentMap = {};
                const aDepartments = [];
                aData.forEach(function (oItem) {
                    const sDepartment = (oItem.department || "").trim();
                    if (sDepartment && !oDepartmentMap[sDepartment.toLowerCase()]) {
                        oDepartmentMap[sDepartment.toLowerCase()] = true;
                        aDepartments.push({
                            department: sDepartment
                        });
                    }
                });
                this.getView().setModel(new JSONModel(aDepartments), "DepartmentModel");
                const oRoleMap = {};
                const aRoles = [];
                aData.forEach(function (oItem) {
                    const sRole = (oItem.role || "").trim();
                    const sDepartment = (oItem.department || "").trim();
                    const sKey = sDepartment.toLowerCase() + "_" + sRole.toLowerCase();
                    if (sRole && !oRoleMap[sKey]) {
                        oRoleMap[sKey] = true;
                        aRoles.push({
                            department: sDepartment,
                            // NEW
                            role: sRole,
                            // KEEP OLD
                            designationName: sRole
                        });
                    }
                });
                this.getView().setModel(new JSONModel(aRoles), "RoleModel");
                this.getView().setModel(new JSONModel([]), "FilteredRoleModel");
            },
            // POLICY VISIBILITY FILTER
            PL_filterPoliciesByAccess: async function (aPolicies) {
                const oEmp = await this._getEmployeeDetails();
                const sEmployeeDepartment = (oEmp.department || "").toLowerCase().trim();
                const sEmployeeRole = (oEmp.role || "").toLowerCase().trim();
                const aFilteredPolicies = aPolicies.filter(function (oPolicy, iIndex) {
                    const sPolicyDepartment = (oPolicy.Department || oPolicy.department || "").toLowerCase().trim();
                    const aPolicyRoles = (oPolicy.Role || oPolicy.role || "").toLowerCase().split(",").map(r => r.trim());
                    // ADMIN / HR MANAGER
                    if (sEmployeeRole === "admin" || sEmployeeRole === "hr manager") {
                        return true;
                    }
                    // ALL / ALL
                    if (sPolicyDepartment === "all" && aPolicyRoles.includes("all")) {
                        return true;
                    }
                    // ALL DEPARTMENT + ROLE MATCH
                    if (sPolicyDepartment === "all" && aPolicyRoles.includes(sEmployeeRole)) {
                        return true;
                    }
                    // DEPARTMENT MATCH + ALL ROLE
                    if (sPolicyDepartment === sEmployeeDepartment && aPolicyRoles.includes("all")) {
                        return true;
                    }
                    // DEPARTMENT MATCH + MULTIPLE ROLE MATCH
                    if (sPolicyDepartment === sEmployeeDepartment && aPolicyRoles.includes(sEmployeeRole)) {
                        return true;
                    }
                    return false;
                });
                return aFilteredPolicies;
            },
            // ROUTE MATCHED
            PL_onRouteMatched: async function () {
                try {
                    this._employeeCache = null;
                    this._employeePromise = null;
                    var LoginFunction = await this.commonLoginFunction("Policy");
                    if (!LoginFunction) {
                        return;
                    }
                    this.getBusyDialog();
                    const oView = this.getView();
                    const oLoginModel = oView.getModel("LoginModel");
                    this.i18nModel = this.getOwnerComponent().getModel("i18n").getResourceBundle();
                    oLoginModel.setProperty("/HeaderName", this.i18nModel.getText("policyTitle"));
                    // Load Employee Details First
                    await this._getEmployeeDetails();
                    // Load Role Department
                    await this.PL_loadRoleDepartment();
                    this.byId("PL_id_PolicyPage").setEnableScrolling(sap.ui.Device.system.phone);
                    this.byId("PL_id_SearchPolicy").setValue("");
                    this.byId("PL_id_DepartmentFilter").setValue("");
                    this.byId("PL_id_RoleFilter").setValue("");
                    // Load Policies After Employee Details
                    await this.PL_loadPolicies();
                    this.getView().setModel(new JSONModel({
                        EditBtn: true
                    }), "VisibleModel");
                    const sRole = (oLoginModel.getProperty("/Role") || "").toLowerCase().trim();
                    const bShowAdminControls = sRole === "admin" || sRole === "hr manager";
                    this.getView().setModel(new JSONModel({
                        showAdminControls: bShowAdminControls
                    }), "visibilityModel");
                    sap.ui.getCore().applyChanges();
                    this.closeBusyDialog();
                } catch (oError) {
                    this.closeBusyDialog();
                    MessageBox.error(oError.message || "Failed to load policies");
                }
            },
            PL_applyFilter: function (sDepartment, sRole) {
                const oTable = this.byId("PL_id_PolicyTable");
                const oBinding = oTable.getBinding("items");
                let aFilters = [];
                if (sDepartment) {
                    aFilters.push(new sap.ui.model.Filter("department", sap.ui.model.FilterOperator.EQ, sDepartment));
                }
                if (sRole) {
                    aFilters.push(new sap.ui.model.Filter("role", sap.ui.model.FilterOperator.EQ, sRole));
                }
                oBinding.filter(aFilters);
            },
            // LOAD POLICIES
            PL_loadPolicies: async function (aFilters = []) {
                try {
                    const oResponse = await this.ajaxReadWithJQuery("Policy", aFilters && aFilters.length ? aFilters[0] : {});
                    let aPolicies = [];
                    if (oResponse && oResponse.success && oResponse.data) {
                        aPolicies = oResponse.data.map(function (oItem, index) {
                            // IMAGE 
                            let sImageUrl = "sap-icon://person-placeholder";
                            if (oItem.Logo) {
                                if (typeof oItem.Logo === "string") {
                                    sImageUrl = "data:image/png;base64," + oItem.Logo;
                                } else if (oItem.Logo.data) {
                                    const sBase64 = new TextDecoder().decode(new Uint8Array(oItem.Logo.data));
                                    sImageUrl = "data:image/png;base64," + sBase64;
                                }
                            }
                            //  ITEMS 
                            const aItems = Array.isArray(oItem.Items) ? oItem.Items : [];
                            const today = new Date();
                            // Remove time part
                            today.setHours(0, 0, 0, 0);
                            // ACTIVE VERSION 
                            let aActiveVersions = aItems.filter(function (v) {
                                if (!v.Start_Date) {
                                    return false;
                                }
                                const dStart = new Date(v.Start_Date);
                                dStart.setHours(0, 0, 0, 0);
                                let dEnd = null;
                                if (v.End_Date && !String(v.End_Date).includes("1899-11-30")) {
                                    dEnd = new Date(v.End_Date);
                                    dEnd.setHours(0, 0, 0, 0);
                                }
                                // Open-ended version
                                if (!dEnd) {
                                    return dStart <= today;
                                }
                                return (dStart <= today && today <= dEnd);
                            });
                            let oLatest = null;
                            // Active version exists
                            if (aActiveVersions.length > 0) {
                                oLatest = aActiveVersions.reduce(function (max, item) {
                                    return parseFloat(item.Version || 0) > parseFloat(max.Version || 0) ? item : max;
                                });
                            }
                            // No active version -> latest version
                            // No active version
                            else if (aItems.length > 0) {
                                // Future versions only
                                const aFutureVersions = aItems.filter(function (v) {
                                    if (!v.Start_Date) {
                                        return false;
                                    }
                                    const dStart = new Date(v.Start_Date);
                                    dStart.setHours(0, 0, 0, 0);
                                    return dStart > today;
                                });
                                // If all versions are future dated
                                if (aFutureVersions.length === aItems.length) {
                                    oLatest = aFutureVersions.reduce(function (nearest, current) {
                                        const nearestDate = new Date(nearest.Start_Date);
                                        nearestDate.setHours(0, 0, 0, 0);
                                        const currentDate = new Date(current.Start_Date);
                                        currentDate.setHours(0, 0, 0, 0);
                                        return currentDate < nearestDate ? current : nearest;
                                    });
                                } else {
                                    // Existing functionality unchanged
                                    oLatest = aItems.reduce(function (max, item) {
                                        return parseFloat(item.Version || 0) > parseFloat(max.Version || 0) ? item : max;
                                    });
                                }
                            }
                            oLatest = oLatest || {};
                            return {
                                ID: oItem.ID,
                                name: oItem.PolicyName,
                                desc: oItem.PolicyDesc,
                                currentVersion: oLatest.Version || "1.0",
                                Start_Date: oLatest.Start_Date ? new Date(oLatest.Start_Date).toLocaleDateString("en-GB") : "",
                                End_Date: oLatest.End_Date && !String(oLatest.End_Date).includes("1899-11-30") ? new Date(oLatest.End_Date).toLocaleDateString("en-GB") : "",
                                File_Name: oLatest.File_Name || "",
                                File_Content: oLatest.File_Content || "",
                                File_Type: oLatest.File_Type || "",
                                UploadDate: oItem.UploadDate ? new Date(oItem.UploadDate).toLocaleDateString("en-GB") : "",
                                department: oItem.Department || "",
                                role: (oItem.Role || "").split(",").join(" , "),
                                employeeIds: (oItem.EmployeeID || "").toString().trim(),
                                imageUrl: sImageUrl,
                                selected: false
                            };
                        }.bind(this));
                        aPolicies = await this.PL_filterPoliciesByAccess(aPolicies);
                    }
                    this.getView().setModel(new JSONModel({
                        policies: aPolicies
                    }), "policyModel");
                    this.getView().getModel("policyModel").refresh(true);
                } catch (oError) {
                    MessageBox.error("Failed to load policies");
                }
            },
            _getLatestVersionStartDate: function (aItems) {
                if (!Array.isArray(aItems) || aItems.length === 0) {
                    return null;
                }
                const oLatest = aItems.reduce((max, item) => {
                    const v1 = parseFloat(item.Version || "0");
                    const v2 = parseFloat(max.Version || "0");
                    return v1 > v2 ? item : max;
                });
                return oLatest.Start_Date ? new Date(oLatest.Start_Date) : null;
            },
            _getActivePolicyVersion: function (aItems) {
                const today = new Date();
                let oActive = aItems.find(v => {
                    const dStart = v.Start_Date ? new Date(v.Start_Date) : null;
                    const dEnd = v.End_Date ? new Date(v.End_Date) : null;
                    if (!dStart) return false;
                    if (!dEnd || isNaN(dEnd.getTime())) {
                        return dStart <= today;
                    }
                    return dStart <= today && today <= dEnd;
                });
                if (!oActive && aItems.length) {
                    oActive = aItems.reduce((max, item) => {
                        const v1 = item.Version || "0";
                        const v2 = max.Version || "0";
                        const a = v1.split(".").map(Number);
                        const b = v2.split(".").map(Number);
                        for (let i = 0; i < Math.max(a.length, b.length); i++) {
                            const diff = (a[i] || 0) - (b[i] || 0);
                            if (diff > 0) return item;
                            if (diff < 0) return max;
                        }
                        return max;
                    }, aItems[0]);
                }
                return oActive || {};
            },
            // FILTER ROLE BASED ON DEPARTMENT
            PL_onDepartmentChange: function (oEvent) {
                var oCombo = oEvent.getSource();
                var sDepartment = oCombo.getSelectedKey() || oCombo.getValue();

                if (sDepartment) {
                    oCombo.setValueState("None");
                    oCombo.setValueStateText("");
                }

                var oDesignationModel = this.getView().getModel("DesignationModel");
                if (!oDesignationModel) {
                    console.error("DesignationModel NOT FOUND");
                    return;
                }

                var aData = oDesignationModel.getData();

                // CLEAR OLD ROLES
                this.getView().setModel(new JSONModel([]), "FilteredRoleModel");

                if (!aData || aData.length === 0) {
                    console.error("DesignationModel is EMPTY");
                    return;
                }

                // FILTER ROLES FOR SELECTED DEPARTMENT
                var aFilteredRoles = aData.filter(function (oItem) {
                    return (oItem.department || "").trim().toLowerCase() === (sDepartment || "").trim().toLowerCase();
                });

                var oUnique = {};
                var aUniqueRoles = [];
                aFilteredRoles.forEach(function (oItem) {
                    var sRole = (oItem.designationName || "").trim();
                    if (sRole && !oUnique[sRole]) {
                        oUnique[sRole] = true;
                        aUniqueRoles.push({ designationName: sRole });
                    }
                });

                this.getView().setModel(new JSONModel(aUniqueRoles), "FilteredRoleModel");

                // RESET: Create dialog role (PL_id_Role)
                var oRole = this.byId("PL_id_Role");
                if (oRole) {
                    oRole.setSelectedKeys([]);
                }

                // RESET: View dialog role (PL_id_ViewRole)
                var oViewRole = this.byId("PL_id_ViewRole");
                if (oViewRole) {
                    oViewRole.setSelectedKeys([]);
                }

                // RESET: FilterBar role (PL_id_RoleFilter)
                var oRoleFilter = this.byId("PL_id_RoleFilter");
                if (oRoleFilter) {
                    oRoleFilter.setSelectedKeys([]);
                }

                // RESET: policyViewModel role
                var oPolicyViewModel = this.getView().getModel("policyViewModel");
                if (oPolicyViewModel) {
                    oPolicyViewModel.setProperty("/role", []);
                }

                // RESET: policyDialogModel role
                var oDialogModel = this.getView().getModel("policyDialogModel");
                if (oDialogModel) {
                    oDialogModel.setProperty("/role", []);
                }
            },
            PL_onRemovePdf: function () {
                const oModel = this.getView().getModel("policyDialogModel");
                oModel.setProperty("/File_Content", "");
                oModel.setProperty("/File_Name", "");
                oModel.setProperty("/File_Type", "");
                this.byId("PL_id_FileUploader").clear();
                // Optional: reset value state
                this.byId("PL_id_FileUploader").setValueState("None");
            },
            PL_onRemoveLogo: function () {
                const oModel = this.getView().getModel("policyDialogModel");
                oModel.setProperty("/logoBase64", "");
                oModel.setProperty("/logoType", "");
                oModel.setProperty("/logo", "");
                oModel.setProperty("/Logo_Name", "");
                this.byId("PL_id_LogoUploader").clear();
            },
            PL_onFileUpload: function (oEvent) {
                const oFile = oEvent.getParameter("files")[0];
                if (!oFile) {
                    return; // User clicked Cancel -> keep existing file
                }
                // BLOCK OVERSIZED FILES
                if (oFile.size > 5 * 1024 * 1024) {
                    MessageBox.error(this.i18nModel.getText("fileSizeExceeded") || "File size exceeds the limit of 5MB. Please upload a smaller file.");
                    oEvent.getSource().clear();
                    return;
                }
                // BLOCK NON-PDF
                if (oFile.type !== "application/pdf") {
                    MessageBox.error(this.i18nModel.getText("onlyPdfAllowed"));
                    oEvent.getSource().clear();
                    const oModel = this.getView().getModel("policyDialogModel");
                    oModel.setProperty("/File_Content", "");
                    oModel.setProperty("/File_Name", "");
                    oModel.setProperty("/File_Type", "");
                    return;
                }
                // READ FILE
                const oReader = new FileReader();
                oReader.onload = function (e) {
                    const base64 = e.target.result.split(",")[1];
                    const compressedBase64 = this.compressBase64(base64);
                    const oModel = this.getView().getModel("policyDialogModel");
                    oModel.setProperty("/File_Content", compressedBase64);
                    oModel.setProperty("/File_Name", oFile.name);
                    oModel.setProperty("/File_Type", oFile.type);
                }.bind(this);
                oReader.readAsDataURL(oFile);
            },
            __openVersionDialog: async function (oData) {
                let sNextVersion = "1.0";

                try {
                    const oResponse = await this.ajaxReadWithJQuery("PolicyImage", {
                        ID: oData.ID
                    });

                    let aVersions = [];
                    if (oResponse?.data?.Items && Array.isArray(oResponse.data.Items)) {
                        aVersions = oResponse.data.Items;
                    } else if (Array.isArray(oResponse?.data)) {
                        aVersions = oResponse.data;
                    } else if (oResponse?.data) {
                        aVersions = [oResponse.data];
                    }

                    console.log("Versions Found:", aVersions);

                    if (aVersions.length > 0) {
                        let fMaxVersion = 0;
                        aVersions.forEach(function (oItem) {
                            const fVersion = parseFloat(oItem.Version);
                            if (!isNaN(fVersion) && fVersion > fMaxVersion) {
                                fMaxVersion = fVersion;
                            }
                        });
                        sNextVersion = (Math.round((fMaxVersion + 0.1) * 10) / 10).toFixed(1);
                    }

                } catch (e) {
                    console.error("Version Error:", e);
                }

                const oModel = this.getView().getModel("policyDialogModel");
                oModel.setData({
                    policyId: oData.ID,
                    Version: sNextVersion,
                    UploadDate: new Date(),
                    Version_File_Content: "",
                    Version_File_Name: "",
                    Version_File_Type: "",
                    isEdit: true,
                    isVersionMode: true
                });

                oModel.refresh(true);
                this._oVersionDialog.open();
            },
            // version
            PL_onNewVersion: async function (oEvent) {
                this.getBusyDialog();
                const oContext = oEvent.getSource().getBindingContext("policyModel");
                const oData = oContext.getObject();

                let sNextVersion = "1.0";
                this._latestStartDate = null;

                try {
                    const oResponse = await this.ajaxReadWithJQuery("PolicyImage", {
                        ID: oData.ID
                    });

                    // ── safely extract versions array ──
                    let aVersions = [];
                    if (oResponse?.data?.Items && Array.isArray(oResponse.data.Items)) {
                        aVersions = oResponse.data.Items;
                    } else if (Array.isArray(oResponse?.data)) {
                        aVersions = oResponse.data;
                    } else if (oResponse?.data) {
                        aVersions = [oResponse.data];
                    }

                    console.log("Versions Found:", aVersions);

                    if (aVersions.length > 0) {
                        // find highest version number
                        let fMaxVersion = 0;
                        let oLatestItem = null;

                        aVersions.forEach(function (oItem) {
                            const fVersion = parseFloat(oItem.Version);
                            if (!isNaN(fVersion) && fVersion > fMaxVersion) {
                                fMaxVersion = fVersion;
                                oLatestItem = oItem;
                            }
                        });

                        // add 0.1 and keep 1 decimal place
                        sNextVersion = (Math.round((fMaxVersion + 0.1) * 10) / 10).toFixed(1);

                        // store latest start date for date picker min
                        if (oLatestItem && oLatestItem.Start_Date) {
                            this._latestStartDate = new Date(oLatestItem.Start_Date);
                        }
                    }

                } catch (e) {
                    console.error("Version fetch error:", e);
                    sNextVersion = "1.0";
                }

                // ── load fragment if not loaded ──
                if (!this._oVersionDialog) {
                    this._oVersionDialog = sap.ui.xmlfragment(
                        "sap.kt.com.minihrsolution.fragment.PolicyVersionDialog",
                        this
                    );
                    this.getView().addDependent(this._oVersionDialog);
                }

                // ── set model data with computed next version ──
                this.getView().setModel(
                    new JSONModel({
                        Parent_Policy_ID: oData.ID,
                        PolicyName: oData.name,
                        PolicyDesc: oData.desc,
                        Version: sNextVersion,          // ← computed correctly
                        Start_Date: sap.ui.core.format.DateFormat
                            .getDateInstance({ pattern: "dd/MM/yyyy" })
                            .format(new Date()),
                        Version_File_Content: "",
                        Version_File_Name: "",
                        Version_File_Type: ""
                    }),
                    "policyDialogModel"
                );

                this.getView().getModel("policyDialogModel").refresh(true);

                // ── clear file uploader ──
                const oUploader = sap.ui.getCore().byId("PL_id_NewVersionFile");
                if (oUploader) {
                    oUploader.clear();
                    oUploader.setValueState("None");
                }

                this.closeBusyDialog();
                this._oVersionDialog.open();

                // ── apply min date on date picker after dialog renders ──
                setTimeout(() => {
                    const oDatePicker = sap.ui.getCore().byId("PLV_id_StartDate");
                    if (oDatePicker) {
                        if (this._latestStartDate) {
                            oDatePicker.setMinDate(this._latestStartDate);
                        }
                        oDatePicker.setValueState("None");
                        oDatePicker.setValueStateText("");
                    }

                    // ── clear version field errors ──
                    const oVersionInput = sap.ui.getCore().byId("PL_id_Version");
                    if (oVersionInput) {
                        oVersionInput.setValueState("None");
                        oVersionInput.setValueStateText("");
                    }
                }, 100);
            },
            _getNextVersion: function (sVersion) {
                if (!sVersion) {
                    return "1.0";
                }
                const fVersion = parseFloat(sVersion);
                return (Math.round((fVersion + 0.1) * 10) / 10).toFixed(1);
            },
            FileSizeExceeds: function () {
                MessageBox.error(this.i18nModel.getText("fileSizeExceeded") || "File size exceeds the limit of 5MB. Please upload a smaller file.");
            },
            PL_onVersionFileUpload: function (oEvent) {
                const oFile = oEvent.getParameter("files")[0];
                const oModel = this.getView().getModel("policyDialogModel");
                if (!oFile) {
                    return;
                }
                if (oFile.type !== "application/pdf") {
                    MessageBox.error(this.i18nModel.getText("onlyPdfAllowed"));
                    oEvent.getSource().clear();
                    oModel.setProperty("/Version_File_Content", "");
                    oModel.setProperty("/Version_File_Name", "");
                    oModel.setProperty("/Version_File_Type", "");
                    return;
                }
                const oReader = new FileReader();
                oReader.onload = function (e) {
                    const base64 = e.target.result.split(",")[1];
                    const compressedBase64 = this.compressBase64(base64);
                    oModel.setProperty("/Version_File_Content", compressedBase64);
                    oModel.setProperty("/Version_File_Name", oFile.name);
                    oModel.setProperty("/Version_File_Type", oFile.type);
                }.bind(this);
                oReader.readAsDataURL(oFile);
            },
            PL_onRemoveVersionPdf: function () {
                const oModel = this.getView().getModel("policyDialogModel");
                // Clear model
                oModel.setProperty("/Version_File_Content", "");
                oModel.setProperty("/Version_File_Name", "");
                oModel.setProperty("/Version_File_Type", "");
                sap.ui.getCore().byId("PL_id_NewVersionFile").setValue("");
                sap.ui.getCore().byId("PL_id_NewVersionFile").setValueState("None");
            },
            PL_onSaveNewVersion: async function () {
                const oModel = this.getView().getModel("policyDialogModel");
                const oData = oModel.getData();
                const sPolicyId = oData.Parent_Policy_ID;
                if (!sPolicyId) {
                    MessageBox.error(this.i18nModel.getText("policyIdMissing"));
                    return;
                }
                // START DATE VALIDATION
                const oStartDate = sap.ui.getCore().byId("PLV_id_StartDate");
                if (!oStartDate) {
                    MessageBox.error("Start Date field not found");
                    return;
                }
                if (!Validation._LCvalidateDate(oStartDate, "ID")) {
                    oStartDate.setValueState("Error");
                    oStartDate.setValueStateText("Please enter a valid start date");
                    return;
                }
                oStartDate.setValueState("None");
                const oVersionInput = sap.ui.getCore().byId("PL_id_Version");
                if (!Validation._LCvalidateMandatoryField(oVersionInput, "ID")) {
                    oVersionInput.setValueStateText("Enter valid version (e.g. 1.0, 1.1)");
                    return;
                }
                const sVersion = oVersionInput.getValue().trim();
                // STRICT FORMAT VALIDATION
                const versionRegex = /^\d{1}\.\d{1}$/;
                if (!versionRegex.test(sVersion)) {
                    oVersionInput.setValueState("Error");
                    oVersionInput.setValueStateText("Enter valid version format (e.g. 1.0, 2.3)");
                    oVersionInput.focus();
                    return;
                } else {
                    oVersionInput.setValueState("None");
                }
                // CLEAN BASE64
                let Version_File_Content = oData.Version_File_Content || "";
                if (Version_File_Content.includes(",")) {
                    Version_File_Content = Version_File_Content.split(",")[1];
                }
                // SAFETY CHECK 
                if (!Version_File_Content) {
                    MessageBox.error("Please upload PDF file");
                    return;
                }
                if (Version_File_Content.length > 5000000) {
                    MessageBox.error("File too large. Please upload smaller PDF.");
                    return;
                }
                // SAFE DATE FORMAT 
                const formatDate = function (d) {
                    if (!d) return null;
                    const dt = new Date(d);
                    if (isNaN(dt.getTime())) return null;
                    return dt.toISOString().split("T")[0];
                };
                const oPayload = {
                    Policy_Parent_ID: sPolicyId,
                    File_Name: oData.Version_File_Name || "",
                    File_Type: oData.Version_File_Type || "application/pdf",
                    File_Content: Version_File_Content,
                    Start_Date: this._formatDateForDB(oData.Start_Date),
                    UploadDate: this._formatDateForDB(new Date()),
                    End_Date: null,
                    Version: oData.Version || "1.0"
                };
                try {
                    this.getBusyDialog();
                    const oResponse = await this.ajaxCreateWithJQuery("PolicyItems", {
                        data: oPayload
                    });
                    MessageToast.show(this.i18nModel.getText("versionCreatedSuccess"));
                    this._oVersionDialog.close();
                    await this.PL_loadPolicies();
                } catch (e) {
                    MessageBox.error(this.i18nModel.getText("versionAlreadyExists"));
                } finally {
                    this.closeBusyDialog();
                }
            },
            PL_onViewVersion: async function (oEvent) {
                try {
                    this.getBusyDialog();
                    const oContext = oEvent.getSource().getBindingContext("policyModel");
                    const oPolicy = oContext.getObject();
                    const sPolicyId = oPolicy.ID;
                    if (!sPolicyId) {
                        MessageBox.error(this.i18nModel.getText("policyIdMissing"));
                        return;
                    }
                    const oRequest = {
                        ID: sPolicyId
                    };
                    const oResponse = await this.ajaxReadWithJQuery("PolicyImage", oRequest);
                    if (!oResponse || !oResponse.success) {
                        MessageBox.error(oResponse?.message || "Failed to load versions");
                        return;
                    }
                    let aVersions = oResponse.data?.Items || [];
                    if (!Array.isArray(aVersions)) {
                        aVersions = [aVersions];
                    }
                    // Normalize
                    aVersions = aVersions.map(v => ({
                        Version: v.Version || "",
                        Start_Date: v.Start_Date ? new Date(v.Start_Date) : null,
                        End_Date: (v.End_Date && v.End_Date !== "1899-11-30T00:00:00.000Z") ? new Date(v.End_Date) : "",
                        File_Name: v.File_Name || "",
                        File_Type: v.File_Type || "",
                        File_Content: v.File_Content || ""
                    }));
                    // Sort latest first
                    aVersions.sort((a, b) => parseFloat(b.Version || 0) - parseFloat(a.Version || 0));
                    const oVersionModel = new JSONModel({
                        PolicyTitle: oPolicy.name,
                        versions: aVersions
                    });
                    this.getView().setModel(oVersionModel, "versionModel");
                    if (!this._oVersionHistoryDialog) {
                        this._oVersionHistoryDialog = await sap.ui.core.Fragment.load({
                            name: "sap.kt.com.minihrsolution.fragment.PolicyVersionHistory",
                            controller: this
                        });
                        this.getView().addDependent(this._oVersionHistoryDialog);
                    }
                    this._oVersionHistoryDialog.open();
                } catch (e) {
                    MessageBox.error(this.i18nModel.getText("versionLoadFailed"));
                } finally {
                    this.closeBusyDialog();
                }
            },
            onCloseVersionHistory: function () {
                if (this._oVersionHistoryDialog) {
                    this._oVersionHistoryDialog.close();
                }
            },
            onDownloadVersionPdf: function (oEvent) {
                const oData = oEvent.getSource().getBindingContext("versionModel").getObject();

                if (!oData.File_Content) {
                    MessageBox.error(this.i18nModel.getText("noPdfFound"));
                    return;
                }

                try {
                    // 1. Clean the base64 string
                    let sBase64 = String(oData.File_Content)
                        .replace(/^data:.*;base64,/, "")
                        .replace(/\s/g, "");

                    // 2. DECOMPRESS if stored compressed (CRITICAL - this was missing)
                    if (this.isCompressedBase64 && this.isCompressedBase64(sBase64)) {
                        sBase64 = this.decompressBase64(sBase64);
                    }

                    // 3. Validate it's actually a PDF
                    if (!sBase64.startsWith("JVBER")) {
                        MessageBox.error("Invalid PDF file. Cannot download.");
                        return;
                    }

                    // 4. Decode base64 → binary → Blob
                    const sBinary = atob(sBase64);
                    const aBytes = new Uint8Array(sBinary.length);
                    for (let i = 0; i < sBinary.length; i++) {
                        aBytes[i] = sBinary.charCodeAt(i);
                    }

                    const oBlob = new Blob([aBytes], { type: "application/pdf" });

                    // 5. Create Blob URL and trigger download
                    const sBlobUrl = URL.createObjectURL(oBlob);
                    const oLink = document.createElement("a");
                    oLink.href = sBlobUrl;
                    oLink.download = oData.File_Name || "policy.pdf";
                    document.body.appendChild(oLink);
                    oLink.click();
                    document.body.removeChild(oLink);

                    // 6. Release memory
                    setTimeout(function () {
                        URL.revokeObjectURL(sBlobUrl);
                    }, 3000);

                } catch (e) {
                    console.error("PDF download error:", e);
                    MessageBox.error("Failed to download PDF. The file may be corrupted.");
                }
            },
            _createBlobUrlFromBase64: function (sBase64, sMimeType) {
                try {
                    sBase64 = sBase64
                        .replace(/^data:.*;base64,/, "")
                        .replace(/\s/g, "");

                    // Decompress if needed
                    if (this.isCompressedBase64 && this.isCompressedBase64(sBase64)) {
                        sBase64 = this.decompressBase64(sBase64);
                    }

                    const sBinary = atob(sBase64);
                    const aBytes = new Uint8Array(sBinary.length);
                    for (let i = 0; i < sBinary.length; i++) {
                        aBytes[i] = sBinary.charCodeAt(i);
                    }
                    const oBlob = new Blob([aBytes], { type: sMimeType || "application/pdf" });
                    return URL.createObjectURL(oBlob);
                } catch (e) {
                    console.error("Blob URL creation failed:", e);
                    return null;
                }
            },
            PL_onCancelNewVersion: function () {
                // CLEAR FILE UPLOADER
                const oUploader = sap.ui.getCore().byId("PL_id_NewVersionFile");
                if (oUploader) {
                    oUploader.clear();
                    oUploader.setValueState("None");
                }
                // CLEAR START DATE ERROR
                const oStartDate = sap.ui.getCore().byId("PLV_id_StartDate");
                if (oStartDate) {
                    oStartDate.setValueState("None");
                    oStartDate.setValueStateText("");
                }
                // CLEAR VERSION ERROR
                const oVersion = sap.ui.getCore().byId("PL_id_Version");
                if (oVersion) {
                    oVersion.setValueState("None");
                    oVersion.setValueStateText("");
                }
                if (this._oVersionDialog) {
                    this._oVersionDialog.close();
                }
                this.getView().setModel(new JSONModel({}), "policyDialogModel");
            },
            // CREATE
            PL_onCreatePress: function () {
                const oToday = sap.ui.core.format.DateFormat.getDateInstance({
                    pattern: "dd/MM/yyyy"
                }).format(new Date());
                const oDialogModel = new JSONModel({
                    ID: "",
                    title: "",
                    description: "",
                    department: "",
                    role: [],
                    Start_Date: oToday,
                    UploadDate: oToday,
                    // LOGO (FIXED SAFE RESET)
                    logoBase64: null,
                    logoType: "",
                    logo: "",
                    // PDF
                    File_Content: "",
                    File_Name: "",
                    File_Type: "",
                    isEdit: false,
                });
                this.getView().setModel(oDialogModel, "policyDialogModel");
                //  IMPORTANT FIX (forces UI5 binding refresh clean)
                this.getView().getModel("policyDialogModel").refresh(true);
                this.getView().setModel(new JSONModel([]), "FilteredRoleModel");
                this.PL_openDialog();
            },
            // OPEN DIALOG
            PL_openDialog: function () {
                if (this.FPL_oDialog) {
                    this.FPL_oDialog.open();
                    return;
                }
                if (this._bPolicyDialogLoading) return;
                this._bPolicyDialogLoading = true;
                Fragment.load({
                    id: this.getView().getId(),
                    name: "sap.kt.com.minihrsolution.fragment.PolicyDialog",
                    controller: this
                }).then(function (oDialog) {
                    this.FPL_oDialog = oDialog;
                    this.getView().addDependent(oDialog);
                    this._bPolicyDialogLoading = false;
                    oDialog.open();
                    // 🔥 ADD THIS FIX
                    const oDept = this.byId("PL_id_Department");
                    if (oDept) {
                        const sDept = oDept.getSelectedKey();
                        if (sDept) {
                            this._updateRoleModel(sDept);
                        }
                    }
                    this._FragmentDatePickersReadOnly([
                        this.getView().createId("PL_id_StartDate"),
                        this.getView().createId("PL_id_UploadDate")
                    ]);
                }.bind(this)).catch(function (oError) {
                    this._bPolicyDialogLoading = false;
                }.bind(this));
            },
            // live validation
            // REMOVE ERROR FOR INPUT
            PL_onLiveChangeValidation: function (oEvent) {
                var oField = oEvent.getSource();
                var sValue = oField.getValue().trim();
                if (sValue) {
                    oField.setValueState("None");
                    oField.setValueStateText("");
                }
            },
            // REMOVE ERROR FOR SELECT
            PL_onSelectionChangeValidation: function (oEvent) {
                var oField = oEvent.getSource();
                var sValue;
                if (oField.isA("sap.m.MultiComboBox")) {
                    sValue = oField.getSelectedKeys();
                } else if (oField.isA("sap.m.ComboBox")) {
                    sValue = oField.getSelectedKey() || oField.getValue();
                }
                var bValid = Array.isArray(sValue) ? sValue.length > 0 : !!sValue && sValue.trim() !== "";
                //  IMPORTANT: ALWAYS RESET WHEN USER CHANGES SELECTION
                if (bValid) {
                    oField.setValueState("None");
                    oField.setValueStateText("");
                }
            },
            _getFinancialYearRange: function () {
                const today = new Date();
                const year = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
                const startDate = new Date(year, 3, 1); // April 1
                const endDate = new Date(year + 1, 2, 31); // March 31
                return {
                    startDate,
                    endDate
                };
            },
            // REMOVE ERROR FOR DATE
            PL_onDateValidation: function (oEvent) {
                var oField = oEvent.getSource();
                var sValue = oField.getValue().trim();
                const oDate = oEvent.getSource().getDateValue();
                // -----------------------------
                // 1. FINANCIAL YEAR VALIDATION
                // -----------------------------
                const oModel = this.getView().getModel("todayModel");
                const dMin = oModel.getProperty("/minDate");
                const dMax = oModel.getProperty("/maxDate");
                if (oDate && (oDate < dMin || oDate > dMax)) {
                    oField.setValueState("Error");
                    oField.setValueStateText("Date must be within financial year only");
                    return;
                }   
                // -----------------------------
                // 3. EMPTY VALUE CHECK
                // -----------------------------
                if (!sValue) {
                    oField.setValueState("None");
                    oField.setValueStateText("");
                    return;
                }
                // -----------------------------
                // 4. FORMAT VALIDATION
                // -----------------------------
                if (Validation._LCvalidateDate(oField, "ID")) {
                    oField.setValueState("None");
                    oField.setValueStateText("");
                } else {
                    oField.setValueState("Error");
                    oField.setValueStateText("Invalid date format");
                }
            },
            // SAVE
            PL_onSavePolicy: async function () {
                try {
                    // TITLE VALIDATION
                    if (!Validation._LCvalidateMandatoryField(this.byId("PL_id_Title"), "ID",)) {
                        this.byId("PL_id_Title").setValueState("Error");
                        this.byId("PL_id_Title").setValueStateText("Policy title is required");
                        return;
                    }
                    // DESCRIPTION VALIDATION
                    if (!Validation._LCvalidateMandatoryField(this.byId("PL_id_Description"), "ID",)) {
                        this.byId("PL_id_Description").setValueState("Error");
                        this.byId("PL_id_Description").setValueStateText("Please enter policy description");
                        return;
                    }
                    // DEPARTMENT VALIDATION
                    if (!Validation._LCstrictValidationComboBox(this.byId("PL_id_Department"), "ID")) {
                        this.byId("PL_id_Department").setValueState("Error");
                        this.byId("PL_id_Department").setValueStateText("Please select a valid department");
                        return;
                    }
                    // ROLE VALIDATION
                    const oRoleControl = this.byId("PL_id_Role");
                    const aSelectedRoles = oRoleControl.getSelectedKeys();
                    if (!aSelectedRoles || aSelectedRoles.length === 0) {
                        oRoleControl.setValueState("Error");
                        oRoleControl.setValueStateText("Please select at least one role");
                        oRoleControl.focus(); // IMPORTANT (forces message display)
                        return;
                    } else {
                        oRoleControl.setValueState("None");
                        oRoleControl.setValueStateText("");
                    }
                    // MODEL DATA
                    const oData = this.getView().getModel("policyDialogModel").getData();
                    // PDF VALIDATION
                    if (!oData.File_Content) {
                        MessageBox.error(this.i18nModel.getText("policyPdfRequired"));
                        return;
                    }
                    // START DATE VALIDATION
                    if (!Validation._LCvalidateDate(this.byId("PL_id_StartDate"), "ID")) {
                        this.byId("PL_id_StartDate").setValueState("Error");
                        this.byId("PL_id_StartDate").setValueStateText("Please enter a valid start date");
                        return;
                    }
                    // CREATE DATE VALIDATION
                    if (!Validation._LCvalidateDate(this.byId("PL_id_UploadDate"), "ID")) {
                        this.byId("PL_id_UploadDate").setValueState("Error");
                        this.byId("PL_id_UploadDate").setValueStateText("Please enter a valid date");
                        return;
                    }
                    const sStartDate = oData.Start_Date;
                    // const dStartDate = new Date(sStartDate.split("/").reverse().join("-"));
                    // const dToday = new Date();
                    // dToday.setHours(0, 0, 0, 0);
                    // dStartDate.setHours(0, 0, 0, 0);
                    // if (dStartDate < dToday) {
                    //     this.byId("PL_id_StartDate").setValueState("Error");
                    //     this.byId("PL_id_StartDate").setValueStateText(this.i18nModel.getText("startDatePastNotAllowed"));
                    //     MessageBox.error(this.i18nModel.getText("startDatePastNotAllowed"));
                    //     return;
                    // }
                    // PAYLOAD
                    const sEmployeeId = String(
                        this.getView().getModel("LoginModel").getProperty("/EmployeeID") || ""
                    ).trim();
                    const oPayloadData = {
                        EmployeeID: sEmployeeId || "",
                        PolicyName: oData.title,
                        PolicyDesc: oData.description,
                        Department: oData.department || "",
                        Role: Array.isArray(oData.role) ? oData.role.join(",") : (this.byId("PL_id_Role").getSelectedKeys().join(",") || ""),
                        Start_Date: oData.Start_Date.split('/').reverse().join('-'),
                        UploadDate: oData.UploadDate.split('/').reverse().join('-'),
                        File_Content: oData.File_Content,
                        File_Name: oData.File_Name,
                        File_Type: oData.File_Type,
                        Logo: oData.logoBase64 || "",
                    };
                    // BUSY DIALOG
                    this.getBusyDialog();
                    // CLEAR FILE UPLOADERS
                    var aUploaders = this.getView().findAggregatedObjects(true, function (oControl) {
                        return oControl.isA("sap.ui.unified.FileUploader");
                    });
                    aUploaders.forEach(function (oUploader) {
                        oUploader.clear();
                    });
                    // UPDATE / CREATE
                    if (oData.isEdit) {
                        const oUpdatePayload = {
                            filters: {
                                ID: oData.ID,
                            },
                            data: oPayloadData,
                        };
                        await this.ajaxUpdateWithJQuery("Policy", oUpdatePayload);
                    } else {
                        const oResponse = await this.ajaxCreateWithJQuery("Policy", {
                            data: oPayloadData,
                        });
                        // GET CURRENT MODEL
                        const oPolicyModel = this.getView().getModel("policyModel");
                        const aPolicies = oPolicyModel.getProperty("/policies") || [];
                        // CREATE NEW UI OBJECT (same format as search)
                        const oNewPolicy = {
                            ID: oResponse?.data?.ID || oPayloadData.ID || Date.now(),
                            name: oPayloadData.PolicyName,
                            desc: oPayloadData.PolicyDesc,
                            UploadDate: new Date(oPayloadData.UploadDate).toLocaleDateString("en-GB"),
                            Start_Date: new Date(oPayloadData.Start_Date).toLocaleDateString("en-GB"),
                            department: oPayloadData.Department,
                            role: oPayloadData.Role,
                            currentVersion: "1.0",
                            employeeIds: "",
                            imageUrl: "sap-icon://person-placeholder",
                            File_Content: oPayloadData.File_Content,
                            File_Name: oPayloadData.File_Name,
                            File_Type: oPayloadData.File_Type,
                            selected: false
                        };
                        // ADD NEW POLICY ON TOP (LATEST FIRST)
                        aPolicies.unshift(oNewPolicy);
                        // UPDATE MODEL
                        oPolicyModel.setProperty("/policies", aPolicies);
                        oPolicyModel.refresh(true);
                    }
                    // SUCCESS MESSAGE
                    MessageToast.show(this.i18nModel.getText("policyCreateSuccess"));
                    // CLOSE DIALOG
                    if (this.FPL_oDialog) {
                        this.FPL_oDialog.close();
                    }
                    // RESET ROLE + DEPENDENCY STATE AFTER SAVE
                    this.getView().setModel(new JSONModel({
                        ID: "",
                        title: "",
                        description: "",
                        department: "",
                        role: [],
                        logoBase64: "",
                        logoType: "",
                        logo: "",
                        File_Content: "",
                        File_Name: "",
                        File_Type: "",
                        isEdit: false
                    }), "policyDialogModel");
                    this.getView().setModel(new JSONModel([]), "FilteredRoleModel");
                    var oDept = this.byId("PL_id_Department");
                    var oRole = this.byId("PL_id_Role");
                    if (oDept) {
                        oDept.setSelectedKey("");
                        oDept.setValue("");
                    }
                    if (oRole) {
                        oRole.setSelectedKeys([]);
                        oRole.setValue("");
                    }
                    var oRoleFilter = this.byId("PL_id_RoleFilter");
                    if (oRoleFilter) {
                        oRoleFilter.setSelectedKeys([]);
                        oRoleFilter.setValue("");
                    }
                    try {
                        const sSearch = this.byId("PL_id_SearchPolicy")?.getValue()?.trim() || "";
                        const sDepartment = this.byId("PL_id_DepartmentFilter")?.getSelectedKey()?.trim() || "";
                        const sRole = (this.byId("PL_id_RoleFilter")?.getSelectedKeys() || []).join(",");
                        if (sSearch || sDepartment || sRole) {
                            await this.PL_onSearchPolicy();
                        } else {
                            await this.PL_loadPolicies();
                        }
                        const aPolicies = oPolicyModel.getProperty("/policies") || [];
                        oPolicyModel.setProperty("/policies", aPolicies);
                        oPolicyModel.refresh(true);
                        //  FIX: update master copy ONLY ONCE HERE
                        this._aAllPolicies = aPolicies;
                    } catch (oRefreshError) {
                        console.error(oRefreshError);
                    }
                    // CLOSE BUSY
                    this.closeBusyDialog();
                } catch (oError) {
                    this.closeBusyDialog();
                    MessageBox.error(oError.message || "Save failed");
                }
            },
            // CANCEL
            PL_onCancelPolicy: function () {
                // RESET MODEL
                this.getView().setModel(new JSONModel({
                    ID: "",
                    title: "",
                    description: "",
                    role: [],
                    logoBase64: "",
                    logoType: "",
                    logo: "",
                    File_Content: "",
                    File_Name: "",
                    File_Type: "",
                    isEdit: false,
                }), "policyDialogModel");
                // RESET VALIDATION STATES
                this.byId("PL_id_Title").setValueState("None");
                this.byId("PL_id_Description").setValueState("None");
                this.byId("PL_id_Department").setValueState("None");
                this.byId("PL_id_Role").setValueState("None");
                // IMPORTANT: CLEAR DEPENDENCY (ROLE LIST)
                this.getView().setModel(new JSONModel([]), "FilteredRoleModel");
                //  RESET COMBOBOX VALUES (CRITICAL)
                var oDept = this.byId("PL_id_Department");
                var oRole = this.byId("PL_id_Role");
                if (oDept) {
                    oDept.setSelectedKey("");
                    oDept.setValue("");
                }
                if (oRole) {
                    oRole.setSelectedKeys([]);
                    oRole.setValue("");
                }
                // CLEAR FILE UPLOADERS
                var aUploaders = this.getView().findAggregatedObjects(true, function (oControl) {
                    return oControl.isA("sap.ui.unified.FileUploader");
                });
                aUploaders.forEach(function (oUploader) {
                    oUploader.clear();
                });
                var oLogoUploader = this.byId("PL_id_LogoUploader");
                if (oLogoUploader) {
                    oLogoUploader.clear();
                }
                // CLOSE DIALOG
                if (this.FPL_oDialog) {
                    this.FPL_oDialog.close();
                }
            },
            // LOGO UPLOAD
            PL_onLogoUpload: function (oEvent) {
                const oModel = this.getView().getModel("policyDialogModel");
                const aFiles = oEvent.getParameter("files");
                if (!aFiles || aFiles.length === 0) {
                    // Remove logo data from model
                    oModel.setProperty("/logoBase64", "");
                    oModel.setProperty("/logoType", "");
                    oModel.setProperty("/logo", "");
                    oModel.setProperty("/Logo_Name", "");
                    this.byId("PL_id_LogoUploader").clear();
                    return;
                }
                const oFile = aFiles[0];
                // Remove old logo only when a new file is selected
                oModel.setProperty("/logoBase64", "");
                oModel.setProperty("/logoType", "");
                oModel.setProperty("/logo", "");
                if (!oFile.type.startsWith("image/")) {
                    MessageBox.error("Only images allowed");
                    return;
                }
                const reader = new FileReader();
                reader.onload = function (e) {
                    const base64 = e.target.result.split(",")[1];
                    oModel.setProperty("/logoBase64", base64);
                    oModel.setProperty("/logoType", oFile.type);
                    oModel.setProperty("/Logo_Name", oFile.name);
                }.bind(this);
                reader.readAsDataURL(oFile);
            },
            // LOGO TYPE VALIDATION
            PL_onLogoTypeMissmatch: function () {
                MessageBox.error(this.i18nModel.getText("onlyImagesAllowed"));
            },
            // LOGO SIZE EXCEED
            PL_onLogoSizeExceed: function () {
                MessageBox.error(this.i18nModel.getText("logoSizeExceeded"));
            },
            PL_onViewPolicy: async function (oEvent) {
                this._applyStartDateStyle();
                const oObject = oEvent.getSource().getBindingContext("policyModel").getObject();
                this._selectedPolicyId = oObject.ID;
                try {
                    this.getBusyDialog();
                    const [oResponse, oPolicyResponse] = await Promise.all([
                        this.ajaxReadWithJQuery("PolicyImage", {
                            ID: oObject.ID,
                            Parent_Policy_ID: oObject.ID
                        }),
                        this.ajaxReadWithJQuery("Policy", {
                            ID: oObject.ID
                        })
                    ]);
                    if (!oResponse || !oResponse.success) {
                        this.closeBusyDialog();
                        MessageBox.error("No PDF data found");
                        return;
                    }
                    let oPolicyData = Array.isArray(oResponse.data) ? oResponse.data[0] : oResponse.data;
                    const aItems = oPolicyData?.Items || [];
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    //  ACTIVE VERSION 
                    let activeVersions = [];
                    // DO NOT declare today again — reuse existing one
                    for (let i = 0; i < aItems.length; i++) {
                        const v = aItems[i];
                        const dStart = v.Start_Date ? new Date(v.Start_Date) : null;
                        const dEnd = v.End_Date ? new Date(v.End_Date) : null;
                        if (!dStart) continue;
                        dStart.setHours(0, 0, 0, 0);
                        const isNoEnd = !v.End_Date || v.End_Date === "1899-11-30T00:00:00.000Z" || isNaN(dEnd?.getTime());
                        if (!isNoEnd && dEnd) {
                            dEnd.setHours(0, 0, 0, 0);
                        }
                        const isActive = dStart <= today && (isNoEnd || today <= dEnd);
                        if (isActive) {
                            activeVersions.push(v);
                        }
                    }
                    // pick latest active version
                    let oSelectedVersion = null;
                    if (activeVersions.length > 0) {
                        oSelectedVersion = activeVersions.reduce((max, item) => {
                            const v1 = String(item.Version || "0").split(".").map(Number);
                            const v2 = String(max.Version || "0").split(".").map(Number);
                            for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
                                const diff = (v1[i] || 0) - (v2[i] || 0);
                                if (diff > 0) return item;
                                if (diff < 0) return max;
                            }
                            return max;
                        }, activeVersions[0]);
                    }
                    // Fallback if no active version found
                    if (!oSelectedVersion && aItems.length > 0) {
                        oSelectedVersion = aItems.reduce((latest, item) => {
                            const v1 = parseFloat(item.Version || "0");
                            const v2 = parseFloat(latest.Version || "0");
                            return v1 > v2 ? item : latest;
                        }, aItems[0]);
                    }
                    oSelectedVersion = oSelectedVersion || {};
                    //  BASE64 
                    let sBase64 = "";
                    if (typeof oSelectedVersion?.File_Content === "string") {
                        sBase64 = oSelectedVersion.File_Content;
                    } else if (oSelectedVersion?.File_Content?.data) {
                        const uint8Array = new Uint8Array(oSelectedVersion.File_Content.data);
                        sBase64 = btoa(Array.from(uint8Array).map(byte => String.fromCharCode(byte)).join(""));
                    }
                    // EXTRA FALLBACK
                    if (!sBase64 && aItems.length > 0) {
                        const oFirstItem = aItems[0];
                        if (typeof oFirstItem.File_Content === "string") {
                            sBase64 = oFirstItem.File_Content;
                        } else if (oFirstItem.File_Content?.data) {
                            const uint8Array = new Uint8Array(oFirstItem.File_Content.data);
                            sBase64 = btoa(Array.from(uint8Array).map(byte => String.fromCharCode(byte)).join(""));
                        }
                    }
                    if (!sBase64) {
                        this.closeBusyDialog();
                        MessageBox.error(this.i18nModel.getText("pdfEmpty"));
                        return;
                    }

                    sBase64 = String(sBase64)
                        .replace(/^data:.*;base64,/, "")
                        .replace(/\s/g, "");

                    // Decompress if stored using compressBase64()
                    if (this.isCompressedBase64(sBase64)) {
                        sBase64 = this.decompressBase64(sBase64);
                    }

                    // Validate PDF after decompression
                    if (!sBase64.startsWith("JVBER")) {
                        this.closeBusyDialog();
                        MessageBox.error(this.i18nModel.getText("invalidPdf"));
                        return;
                    }
                    this._policyPdfUrl = "data:application/pdf;base64," + sBase64;
                    // ACKNOWLEDGEMENT 
                    const sEmployeeId = String(this.getView().getModel("LoginModel").getProperty("/EmployeeID")).trim();
                    let sAckIds = "";
                    if (Array.isArray(oPolicyResponse.data)) {
                        sAckIds = oPolicyResponse.data[0]?.EmployeeID || "";
                    } else {
                        sAckIds = oPolicyResponse.data?.EmployeeID || "";
                    }
                    const aAckIds = String(sAckIds).split(",").map(id => id.trim()).filter(Boolean);
                    const bAlreadyAcknowledged = aAckIds.includes(sEmployeeId);
                    //  MODEL
                    const oViewModel = new JSONModel({
                        title: oObject.name,
                        description: oObject.desc,
                        UploadDate: oObject.UploadDate || "",
                        department: oObject.department || oObject.Department || "",
                        role: oObject.role ? oObject.role.split(",").map(r => r.trim()) : (oObject.Role ? oObject.Role.split(",").map(r => r.trim()) : []),
                        Version: oSelectedVersion.Version || "",
                        Start_Date: oSelectedVersion.Start_Date ? new Date(oSelectedVersion.Start_Date).toLocaleDateString("en-GB") : "",
                        File_Name: oSelectedVersion.File_Name || "Policy.pdf",
                        File_Type: "application/pdf",
                        fileUrl: this._policyPdfUrl,
                        fullScreen: false,
                        acknowledged: false,
                        employeeIds: sAckIds,
                        alreadyAcknowledged: bAlreadyAcknowledged
                    });
                    this.getView().setModel(oViewModel, "policyViewModel");
                    this.closeBusyDialog();
                    this.PL_openViewDialog();
                } catch (e) {
                    this.closeBusyDialog();
                    MessageBox.error(this.i18nModel.getText("policyPdfLoadFailed"));
                }
            },
            onAcknowledgeCheck: function (oEvent) {
                const bSelected = oEvent.getParameter("selected");
                this.getView().getModel("policyViewModel").setProperty("/acknowledged", bSelected);
            },
            onPressAcknowledge: function () {
                const sEmployeeId = String(this.getView().getModel("LoginModel").getProperty("/EmployeeID")).trim();
                const oViewModel = this.getView().getModel("policyViewModel");
                // EXISTING IDS
                let sExistingIds = oViewModel.getProperty("/employeeIds") || "";
                let aIds = sExistingIds ? sExistingIds.split(",") : [];
                aIds = aIds.map(function (id) {
                    return id.trim();
                }).filter(Boolean);
                // ADD EMPLOYEE ONLY ONCE
                if (!aIds.includes(sEmployeeId)) {
                    aIds.push(sEmployeeId);
                }
                const sFinalIds = aIds.join(",");
                MessageBox.confirm(this.i18nModel.getText("policyAcknowledgeConfirm"), {
                    title: "Confirmation",
                    actions: [
                        MessageBox.Action.YES,
                        MessageBox.Action.NO
                    ],
                    emphasizedAction: MessageBox.Action.YES,
                    onClose: function (sAction) {
                        if (sAction !== MessageBox.Action.YES) {
                            oViewModel.setProperty("/acknowledged", false);
                            return;
                        }
                        this.getBusyDialog();
                        this.ajaxUpdateWithJQuery("Policy", {
                            filters: {
                                ID: this._selectedPolicyId
                            },
                            data: {
                                EmployeeID: sFinalIds
                            }
                        }).then(async function () {
                            // UPDATE LOCAL MODEL
                            oViewModel.setProperty("/employeeIds", sFinalIds);
                            oViewModel.setProperty("/alreadyAcknowledged", true);
                            oViewModel.setProperty("/acknowledged", false);
                            oViewModel.refresh(true);
                            // VERIFY DATABASE VALUE
                            const oCheck = await this.ajaxReadWithJQuery("Policy", {
                                ID: this._selectedPolicyId
                            });
                            this.closeBusyDialog();
                            MessageToast.show(this.i18nModel.getText("policyAcknowledgeSuccess"));
                            if (this.FPL_oViewDialog) {
                                this.FPL_oViewDialog.close();
                            }
                        }.bind(this)).catch(function (oError) {
                            this.closeBusyDialog();
                            MessageBox.error(this.i18nModel.getText("policyAcknowledgeFailed"));
                        }.bind(this));
                    }.bind(this)
                });
            },
            _createPdfIframe: function () {
                const oModel = this.getView().getModel("policyViewModel");
                const sDataUrl = oModel.getProperty("/fileUrl"); // data:application/pdf;base64,...

                // Revoke any previous blob URL to free memory
                if (this._pdfBlobUrl) {
                    URL.revokeObjectURL(this._pdfBlobUrl);
                    this._pdfBlobUrl = null;
                }

                // Convert data URL → Blob URL (avoids browser block + UI freeze)
                const sBlobUrl = this._createBlobUrlFromBase64(sDataUrl, "application/pdf");

                if (!sBlobUrl) {
                    sap.m.MessageBox.error("Failed to render PDF.");
                    return;
                }

                this._pdfBlobUrl = sBlobUrl; // store for cleanup

                const oHtml = this.byId("pdfFrame");
                oHtml.setContent(
                    "<iframe " +
                    "src='" + sBlobUrl + "#toolbar=0&navpanes=0&scrollbar=0&view=FitH' " +
                    "style='width:100%;height:100vh;border:none;display:block;margin:0;padding:0;' " +
                    ">" +
                    "</iframe>"
                );
            },
            PL_openViewDialog: function () {
                this.getView().getModel("VisibleModel").setProperty("/EditBtn", true);
                this.getBusyDialog();
                const fnLoadPdf = function () {
                    setTimeout(function () {
                        this._createPdfIframe();
                    }.bind(this), 0);
                }.bind(this);
                const fnRefreshPolicyData = async function () {
                    try {
                        const oPolicyResponse = await this.ajaxReadWithJQuery("Policy", {
                            ID: this._selectedPolicyId,
                        });
                        const oData = Array.isArray(oPolicyResponse.data) ? oPolicyResponse.data[0] : oPolicyResponse.data || {};

                        // ACKNOWLEDGEMENT LOGIC
                        let sAckIds = oData.EmployeeID || "";
                        const aAckIds = String(sAckIds).split(",").map(id => id.trim()).filter(Boolean);
                        const sEmployeeId = String(this.getView().getModel("LoginModel").getProperty("/EmployeeID")).trim();
                        const bAlreadyAcknowledged = aAckIds.includes(sEmployeeId);
                        const oModel = this.getView().getModel("policyViewModel");
                        oModel.setProperty("/employeeIds", sAckIds);
                        oModel.setProperty("/alreadyAcknowledged", bAlreadyAcknowledged);
                        oModel.refresh(true);

                        // ACTIVE VERSION
                        const aItems = oData.Items || [];
                        const oActiveItem = this._getActivePolicyItem(aItems);

                        // GET BASE64 AND DECOMPRESS (FIX IS HERE)
                        let sBase64 = oActiveItem?.File_Content || "";
                        sBase64 = String(sBase64).replace(/^data:.*;base64,/, "").replace(/\s/g, "");

                        // DECOMPRESS IF NEEDED
                        if (this.isCompressedBase64 && this.isCompressedBase64(sBase64)) {
                            sBase64 = this.decompressBase64(sBase64);
                        }

                        // Store as data URL for _createPdfIframe to convert to Blob
                        this._policyPdfUrl = "data:application/pdf;base64," + sBase64;
                        oModel.setProperty("/fileUrl", this._policyPdfUrl);

                    } catch (e) {
                        console.error("fnRefreshPolicyData error:", e);
                    }
                }.bind(this);
                if (this.FPL_oViewDialog) {
                    this.FPL_oViewDialog.open();
                    Promise.all([
                        fnRefreshPolicyData(),
                        fnLoadPdf(),
                    ]).finally(() => {
                        this.closeBusyDialog();
                    });
                    return;
                }
                Fragment.load({
                    id: this.getView().getId(),
                    name: "sap.kt.com.minihrsolution.fragment.PolicyViewDialog",
                    controller: this,
                }).then(function (oDialog) {
                    this.FPL_oViewDialog = oDialog;
                    this.getView().addDependent(oDialog);
                    oDialog.open();
                    this._FragmentDatePickersReadOnly([
                        this.getView().createId("PL_id_StartDateText1"),
                    ]);
                    //  pdf name should visible in maximize size code 
                    // setInterval(function () {
                    //     var oChartContainer = this.byId("PL_id_PdfChartContainer");
                    //     var oTitle = this.byId("PL_id_PdfFileName");
                    //     if (oChartContainer && oTitle) {
                    //         oTitle.setVisible(
                    //             oChartContainer.getFullScreen()
                    //         );
                    //     }
                    // }.bind(this), 500);
                    Promise.all([
                        fnRefreshPolicyData(),
                        fnLoadPdf(),
                    ]).finally(() => {
                        this.closeBusyDialog();
                    });
                }.bind(this));
            },
            _getActivePolicyItem: function (aItems) {
                if (!Array.isArray(aItems) || aItems.length === 0) {
                    return null;
                }
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                // STEP 1: get all active items
                const activeItems = aItems.filter((item) => {
                    const dStart = item.Start_Date ? new Date(item.Start_Date) : null;
                    const isNoEnd = !item.End_Date || item.End_Date === "1899-11-30T00:00:00.000Z";
                    const dEnd = isNoEnd ? null : new Date(item.End_Date);
                    if (dStart) {
                        dStart.setHours(0, 0, 0, 0);
                    }
                    if (dEnd) {
                        dEnd.setHours(0, 0, 0, 0);
                    }
                    return (dStart && dStart <= today && (!dEnd || today <= dEnd));
                });
                // ACTIVE VERSION EXISTS
                if (activeItems.length > 0) {
                    activeItems.sort((a, b) => {
                        return parseFloat(b.Version || "0") - parseFloat(a.Version || "0");
                    });
                    return activeItems[0];
                }
                // CHECK FUTURE VERSIONS
                const futureItems = aItems.filter(item => {
                    if (!item.Start_Date) {
                        return false;
                    }
                    const dStart = new Date(item.Start_Date);
                    dStart.setHours(0, 0, 0, 0);
                    return dStart > today;
                });
                // ALL AVAILABLE VERSIONS ARE FUTURE
                if (futureItems.length > 0) {
                    futureItems.sort((a, b) => {
                        const aDate = new Date(a.Start_Date);
                        const bDate = new Date(b.Start_Date);
                        return aDate - bDate; // nearest future date first
                    });
                    return futureItems[0];
                }
                // OTHERWISE SHOW HIGHEST VERSION
                aItems.sort((a, b) => {
                    return parseFloat(b.Version || "0") - parseFloat(a.Version || "0");
                });
                return aItems[0];
            },
            // go button 
            PL_onSearchPolicy: async function () {
                this.getBusyDialog();
                try {
                    // ✅ READ FILTERS ONLY ONCE
                    const sSearch = this.byId("PL_id_SearchPolicy")?.getValue()?.trim() || "";
                    const sDepartment = this.byId("PL_id_DepartmentFilter")?.getSelectedKey()?.trim() || "";
                    const sRole = (this.byId("PL_id_RoleFilter")?.getSelectedKeys() || []).join(",");
                    const bHasFilter = !!(sSearch || sDepartment || sRole);
                    // ✅ API CALL
                    const oResponse = await this.ajaxReadWithJQuery("Policy", {
                        PolicyName: sSearch,
                        Department: sDepartment,
                        Role: sRole
                    });
                    let aPolicies = [];
                    if (oResponse && oResponse.success && Array.isArray(oResponse.data)) {
                        aPolicies = oResponse.data.map((oItem) => {
                            let sImageUrl = "sap-icon://person-placeholder";
                            if (oItem.Logo) {
                                if (typeof oItem.Logo === "string") {
                                    sImageUrl = "data:image/png;base64," + oItem.Logo;
                                } else if (oItem.Logo.data) {
                                    const sBase64 = new TextDecoder().decode(new Uint8Array(oItem.Logo.data));
                                    sImageUrl = "data:image/png;base64," + sBase64;
                                }
                            }
                            const oActiveItem = this._getActivePolicyItem(oItem.Items || []);
                            return {
                                ID: oItem.ID,
                                name: oItem.PolicyName,
                                desc: oItem.PolicyDesc,
                                UploadDate: oItem.UploadDate ? new Date(oItem.UploadDate).toLocaleDateString("en-GB") : "",
                                Start_Date: oItem.Start_Date ? new Date(oItem.Start_Date).toLocaleDateString("en-GB") : "",
                                department: oItem.Department || "",
                                role: oItem.Role || "",
                                currentVersion: oActiveItem?.Version || "1.0",
                                employeeIds: (oItem.EmployeeID || "").toString().trim(),
                                imageUrl: sImageUrl,
                                File_Content: oItem.File_Content || "",
                                File_Name: oItem.File_Name,
                                File_Type: oItem.File_Type,
                                selected: false
                            };
                        });
                        // APPLY ACCESS FILTER ONCE
                        aPolicies = await this.PL_filterPoliciesByAccess(aPolicies);
                    }
                    // UPDATE MODEL
                    const oModel = this.getView().getModel("policyModel");
                    if (oModel) {
                        oModel.setProperty("/policies", aPolicies);
                    }
                    // MASTER COPY FIX (VERY IMPORTANT)
                    if (bHasFilter) {
                        // keep original backup unchanged
                    } else {
                        this._aAllPolicies = aPolicies;
                    }
                } catch (oError) {
                    console.error("PL_onSearchPolicy Error:", oError);
                    MessageBox.error(this.i18nModel.getText("loadPoliciesFailed"));
                } finally {
                    this.closeBusyDialog();
                }
            },
            PL_onClearPolicy: function () {
                // SEARCH
                this.byId("PL_id_SearchPolicy").setValue("");
                // DEPARTMENT
                this.byId("PL_id_DepartmentFilter").setSelectedKey("");
                // ROLE
                this.byId("PL_id_RoleFilter").setSelectedKeys([]);
            },
            PL_onLiveSearchPolicy: function (oEvent) {
                const sValue = (oEvent.getParameter("newValue") || "").toLowerCase().trim();
                const oModel = this.getView().getModel("policyModel");
                //  always cache original data BEFORE modifying model
                if (!this._aAllPolicies) {
                    this._aAllPolicies = oModel.getProperty("/policies") || [];
                }
                let aFilteredPolicies = [];
                // remove undefined variable (aPolicies) issue safely
                const aPolicies = this._aAllPolicies;
                // (keeping your original structure, just making it safe)
                oModel.setProperty("/policies", []);
                oModel.setProperty("/policies", aPolicies);
                oModel.refresh(true);
                // EMPTY SEARCH = RESTORE FULL DATA
                if (!sValue) {
                    aFilteredPolicies = this._aAllPolicies;
                } else {
                    aFilteredPolicies = this._aAllPolicies.filter(function (oPolicy) {
                        return (
                            (oPolicy.name && oPolicy.name.toLowerCase().includes(sValue)) || (oPolicy.desc && oPolicy.desc.toLowerCase().includes(sValue)));
                    });
                }
                oModel.setProperty("/policies", aFilteredPolicies);
            },
            PL_onPressEditAndSave: function (oEvent) {
                debugger;
                if (oEvent.getSource().getText() === "Edit") {
                    this.onPressEdit();
                } else {
                    this.onPressSave();
                }
            },
            _updateRoleModel: function (sDepartment) {
                var aData = this.getView().getModel("DesignationModel").getData() || [];
                var aFilteredRoles = aData.filter(function (oItem) {
                    return (oItem.department || "").trim().toLowerCase() === sDepartment.toLowerCase();
                });
                var oUnique = {};
                var aUniqueRoles = [];
                aFilteredRoles.forEach(function (oItem) {
                    var sRole = (oItem.designationName || "").trim();
                    if (sRole && !oUnique[sRole]) {
                        oUnique[sRole] = true;
                        aUniqueRoles.push({
                            designationName: sRole
                        });
                    }
                });
                var oModel = new JSONModel(aUniqueRoles);
                this.getView().setModel(oModel, "FilteredRoleModel");
                this.getView().getModel("FilteredRoleModel").refresh(true);
            },
            onPressEdit: function () {
                // SWITCH TO EDIT MODE
                this.getView().getModel("VisibleModel").setProperty("/EditBtn", false);
                // GET CURRENT POLICY DATA
                var oPolicyModel = this.getView().getModel("policyViewModel");
                var sDepartment = (oPolicyModel.getProperty("/department") || "").trim();
                // UPDATE ROLE MODEL BASED ON DEPARTMENT
                if (sDepartment) {
                    this._updateRoleModel(sDepartment);
                }
                // OPTIONAL: FORCE UI UPDATE (SAFETY)
                var oRoleCombo = this.byId("PL_id_ViewRole");
                if (oRoleCombo && oRoleCombo.getBinding("items")) {
                    oRoleCombo.getBinding("items").refresh();
                }
                // APPLY UI STYLE FOR EDIT MODE
                this._applyStartDateStyle();
            },
            onPressSave: async function () {
                // TITLE VALIDATION
                if (!Validation._LCvalidateMandatoryField(this.byId("PL_id_ViewTitle"), "ID")) {
                    this.byId("PL_id_ViewTitle").setValueState("Error");
                    this.byId("PL_id_ViewTitle").setValueStateText("Policy title is required");
                    return;
                }
                // DESCRIPTION VALIDATION
                if (!Validation._LCvalidateMandatoryField(this.byId("PL_id_ViewDescription"), "ID")) {
                    this.byId("PL_id_ViewDescription").setValueState("Error");
                    this.byId("PL_id_ViewDescription").setValueStateText("Please enter policy description");
                    return;
                }
                // DEPARTMENT VALIDATION
                if (!Validation._LCstrictValidationComboBox(this.byId("PL_id_ViewDepartment"), "ID")) {
                    this.byId("PL_id_ViewDepartment").setValueState("Error");
                    this.byId("PL_id_ViewDepartment").setValueStateText("Please select a valid department");
                    return;
                }
                // ROLE VALIDATION
                // ROLE VALIDATION (FINAL FIX WITH MESSAGE)
                const oRoleControl = this.byId("PL_id_ViewRole");
                const aSelectedRoles = oRoleControl.getSelectedKeys();
                if (!aSelectedRoles || aSelectedRoles.length === 0) {
                    oRoleControl.setValueState("Error");
                    // THIS IS REQUIRED FOR MESSAGE POPUP BELOW FIELD
                    oRoleControl.setValueStateText("Please select at least one role");
                    oRoleControl.setShowValueStateMessage(true);
                    // force focus so message appears immediately
                    oRoleControl.focus();
                    return;
                } else {
                    oRoleControl.setValueState("None");
                    oRoleControl.setValueStateText("");
                }
                // MODEL DATA
                const oModel = this.getView().getModel("policyViewModel");
                const oData = oModel.getData();
                const sRole = Array.isArray(oData.role) ? oData.role.join(",") : (oData.role || "").toString();
                // UPDATE PAYLOAD
                const oPayload = {
                    filters: {
                        ID: this._selectedPolicyId,
                    },
                    data: {
                        Start_Date: oData.Start_Date,
                        PolicyName: oData.title,
                        PolicyDesc: oData.description,
                        Department: oData.department,
                        Role: sRole,
                    },
                };
                try {
                    // BUSY START
                    this.getBusyDialog();
                    // UPDATE POLICY
                    await this.ajaxUpdateWithJQuery("Policy", oPayload);
                    const sSearch = this.byId("PL_id_SearchPolicy").getValue().trim();
                    const sDepartment = this.byId("PL_id_DepartmentFilter").getValue().trim();
                    const sRole = this.byId("PL_id_RoleFilter").getValue().trim();
                    if (sSearch || sDepartment || sRole) {
                        await this.PL_onSearchPolicy();
                    } else {
                        await this.PL_loadPolicies();
                    }
                    const oPolicyModel = this.getView().getModel("policyModel");
                    if (oPolicyModel) {
                        oPolicyModel.refresh(true);
                    }
                    // ENABLE EDIT BUTTON
                    this.getView().getModel("VisibleModel").setProperty("/EditBtn", true);
                    // APPLY UI STYLE FOR EDIT MODE
                    this._applyStartDateStyle();
                    // CLOSE DIALOG
                    if (this.FPL_oViewDialog) {
                        this.FPL_oViewDialog.close();
                    }
                    // BUSY CLOSE
                    this.closeBusyDialog();
                    // SUCCESS MESSAGE
                    MessageToast.show(this.i18nModel.getText("policyUpdatedSuccess"));
                } catch (oError) {
                    this.closeBusyDialog();
                    MessageBox.error(this.i18nModel.getText("updateFailed"));
                }
            },
            // FORMAT DATE FOR DB
            _formatDateForDB: function (sDate) {
                if (!sDate) return null;
                const d = new Date(sDate);
                if (isNaN(d.getTime())) {
                    return null;
                }
                return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
            },
            onPressback: function () {
                this.getRouter().navTo("RouteTilePage");
            },
            onLogout: function () {
                this.CommonLogoutFunction();
            },
            // view dialog close
            PL_onCloseViewDialog: function () {
                // REVOKE BLOB URL (MEMORY CLEANUP)
                if (this._pdfBlobUrl) {
                    URL.revokeObjectURL(this._pdfBlobUrl);
                    this._pdfBlobUrl = null;
                }
                this.getView().getModel("VisibleModel").setProperty("/EditBtn", true);
                // REMOVE VALUE STATE ERRORS
                if (this.byId("PL_id_ViewTitle")) {
                    this.byId("PL_id_ViewTitle").setValueState("None");
                }
                if (this.byId("PL_id_ViewDescription")) {
                    this.byId("PL_id_ViewDescription").setValueState("None");
                }
                if (this.byId("PL_id_ViewDepartment")) {
                    this.byId("PL_id_ViewDepartment").setValueState("None");
                }
                if (this.byId("PL_id_ViewRole")) {
                    this.byId("PL_id_ViewRole").setValueState("None");
                }
                if (this.byId("PL_id_ViewUploadDate")) {
                    this.byId("PL_id_ViewUploadDate").setValueState("None");
                }
                if (this.FPL_oViewDialog) {
                    this.FPL_oViewDialog.close();
                }
            },
        },);
    },);