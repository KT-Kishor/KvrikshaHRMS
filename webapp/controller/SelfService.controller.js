sap.ui.define(["./BaseController", "../model/formatter", "../utils/validation", "sap/ui/model/json/JSONModel", "sap/m/BusyIndicator", "sap/m/MessageToast", "sap/m/MessageBox", "../utils/SalaryCertificatePDF", "../fonts/EBGaramond", "../fonts/Allura", "../fonts/Poppins", "../fonts/Plight", "sap/suite/ui/commons/Timeline", "sap/suite/ui/commons/TimelineItem", "../utils/PaySlipPDF", "../utils/EmpIPNCAPDF"], (Controller, Formatter, utils, JSONModel, BusyIndicator, MessageToast, MessageBox, jsPDF, EBGaramond, Allura, Poppins, Plight, Timeline, TimelineItem, jsPayslipPDF, EmpIPNCAPDF) => {
  "use strict";
  return Controller.extend("sap.kt.com.minihrsolution.controller.SelfService", {
    Formatter: Formatter,
    UG_DEGREES: ["BTech/BE", "BSc", "BCom", "BA", "BBA", "BCA", "LLB", "MBBS", "BDS", "BHMS", "BAMS", "BUMS", "BPT", "Diploma"],
    PG_DEGREES: ["MTech/ME", "MSc", "MCom", "MA", "MBA", "MCA", "LLM", "MD", "MS", "Pharma D", "MPT", "PG Diploma", "PhD", "MPhil"],

    onInit: function () {
      const today = new Date();
      const nextMonthFirstDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const maxDate18YearsAgo = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
      var oDateModel = new sap.ui.model.json.JSONModel();
      oDateModel.setData({ maxDate: maxDate18YearsAgo, focusedDate: new Date(2000, 0, 1), minDate: new Date(1950, 0, 1), nextMonthMinDate: nextMonthFirstDate });
      this.getView().setModel(oDateModel, "controller");
      this.getRouter().getRoute("SelfService").attachMatched(this._onRouteMatched, this);
      // this.getRouter().navTo("SelfService", { sPath: "SelfService" });
    },
    SS_onChangeCountry: function (oEvent) {
      utils._LCstrictValidationComboBox(oEvent.getSource(), "ID");
      const oSource = oEvent.getSource();
      const oSelectedItem = oSource.getSelectedItem();

      if (!oSelectedItem) {
        oSource.setValueState("None");
        return;
      }

      const sCountryCode = oSelectedItem.getAdditionalText();
      const oView = this.getView() || oSource.getParent();
      const getById = (sId) => oView.byId(sId) || sap.ui.getCore().byId(sId);

      // Clear and Filter State ComboBox
      const oStateCombo = getById("SS_id_State");
      if (oStateCombo) {
        oStateCombo.setSelectedKey("");
        oStateCombo.setValue("");
        oStateCombo.setValueState("None");
        oStateCombo.getBinding("items").filter([new sap.ui.model.Filter("countryCode", sap.ui.model.FilterOperator.EQ, sCountryCode)]);
      }

      // Clear Base Location, Branch Code, and Mobile Number
      const oBaseCombo = getById("SS_id_BaseL");
      if (oBaseCombo) {
        oBaseCombo.setSelectedKey("");
        oBaseCombo.setValue("");
        oBaseCombo.setValueState("None");
      }

      const oBranchInput = getById("SS_id_CompanyCode");
      if (oBranchInput) {
        oBranchInput.setValue("");
        oBranchInput.setValueState("None");
      }

      // Refactored Mobile Number Logic
      const oMobileInput = getById("SS_id_MobileNo");
      if (oMobileInput) {
        oMobileInput.setValue("");
        oMobileInput.setValueState("None");

        // Use the new helper function to set maxLength
        this.setMaxLengthForCountry(oMobileInput, sCountryCode);
      }

      // Corrected STD Code Logic
      const oSTDCombo = getById("SS_id_STDCode");
      if (oSTDCombo) {
        const aItems = oSTDCombo.getItems();
        const oMatch = aItems.find((item) => item.getAdditionalText() === sCountryCode);

        if (oMatch) {
          oSTDCombo.setSelectedItem(oMatch);
          oSTDCombo.setValue(oMatch.getText());
          oSTDCombo.setValueState("None");
        } else {
          oSTDCombo.setValue("");
          oSTDCombo.setValueState("Error");
          oSTDCombo.setValueStateText("No STD code found for this country.");
        }
      }
    },
    SS_onStateChange: function (oEvent) {
      utils._LCstrictValidationComboBox(oEvent.getSource(), "ID");
      const oSource = oEvent.getSource();
      const oSelectedItem = oSource.getSelectedItem();
      const oView = this.getView() || oSource.getParent();
      const getById = (sId) => oView.byId(sId) || sap.ui.getCore().byId(sId);

      // Clear city field and its value state
      const oCityCombo = getById("SS_id_BaseL");
      if (oCityCombo) {
        oCityCombo.setSelectedKey("");
        oCityCombo.setValue("");
        oCityCombo.setValueState("None");
      }

      // Filter the city combo box based on the selected state
      if (oSelectedItem) {
        const sStateName = oSelectedItem.getKey();
        const oFilter = new sap.ui.model.Filter("stateName", sap.ui.model.FilterOperator.EQ, sStateName);
        oCityCombo.getBinding("items").filter([oFilter]);
      } else {
        // If no state is selected, clear the filter
        oCityCombo.getBinding("items").filter([]);
      }
    },
    SS_validateMobileNo1: function (oEvent) {
      this.validateNumberInput(oEvent, "SS_id_STDCode");
    },
    SS_validateMobileNo2: function (oEvent) {
      this.validateNumberInput(oEvent, "SS_id_STDCodeRI");
    },
    SS_validateMobileNo3: function (oEvent) {
      this.validateNumberInput(oEvent, "SS_id_STDCodeRII");
    },
    SS_validateMobileNoRef1: function (oEvent) {
      this.validateNumberInput(oEvent, "AdEmp_id_RCSTDCode");
    },
    SS_validateMobileNoRef2: function (oEvent) {
      this.validateNumberInput(oEvent, "AdEmp_id_RCSTD");
    },

    OnEmp1StdCodeChange: function (oEvent) {
      if (typeof utils !== "undefined" && utils._LCvalidateMandatoryField) {
        utils._LCvalidateMandatoryField(oEvent);
      }

      const oSource = oEvent.getSource();
      const oSelectedItem = oSource.getSelectedItem();
      const oView = this.getView();

      const oMobileInput = sap.ui.getCore().byId("AdEmp_id_RCMobileI");

      if (oMobileInput) {
        // 🔹 Clear mobile input when STD code changes
        oMobileInput.setValue("");
        oMobileInput.setValueState("None");

        let sStdCode = null;

        if (oSelectedItem) {
          sStdCode = oSelectedItem.getText(); // "+91"
          oView.getModel("employmentModel").setProperty("/RCISTDCode", sStdCode);

          const iMaxLength = sStdCode === "+91" ? 10 : 20;
          oMobileInput.setMaxLength(iMaxLength);

        } else {
          // Reset fallback
          oMobileInput.setMaxLength(20);
          oView.getModel("employmentModel").setProperty("/RCISTDCode", null);
        }
      }
    },

    OnEmp2StdCodeChange: function (oEvent) {
      if (typeof utils !== "undefined" && utils._LCvalidateMandatoryField) {
        utils._LCvalidateMandatoryField(oEvent);
      }

      const oSource = oEvent.getSource();
      const oSelectedItem = oSource.getSelectedItem();
      const oView = this.getView();

      const oMobileInput = sap.ui.getCore().byId("AdEmp_id_RCMobileII");

      if (oMobileInput) {
        // 🔹 Clear mobile input when STD code changes
        oMobileInput.setValue("");
        oMobileInput.setValueState("None");

        let sStdCode = null;

        if (oSelectedItem) {
          sStdCode = oSelectedItem.getText(); // "+91"
          oView.getModel("employmentModel").setProperty("/RCIISTDCode", sStdCode);

          const iMaxLength = sStdCode === "+91" ? 10 : 20;
          oMobileInput.setMaxLength(iMaxLength);

        } else {
          // Reset fallback
          oMobileInput.setMaxLength(20);
          oView.getModel("employmentModel").setProperty("/RCIISTDCode", null);
        }
      }
    },

    SS_BD_onStdCodeChange: function (oEvent) {
      utils._LCvalidateMandatoryField(oEvent);

      const oSource = oEvent.getSource();
      const oSelectedItem = oSource.getSelectedItem();
      const oMobileInput = this.getView().byId("SS_id_MobileNo");

      if (oMobileInput) {
        // clear field & model property
        oMobileInput.setValue("");
        oMobileInput.setValueState("None");
        this.getView().getModel("sEmployeeModel").setProperty("/0/MobileNo", "");

        if (oSelectedItem) {
          const sStdCode = oSelectedItem.getKey(); // stdCode is in key
          this.getView().getModel("viewModel").setProperty("/selectedStdCode", sStdCode);

          this.setMaxLengthForCountry(oMobileInput, sStdCode);
        } else {
          oMobileInput.setMaxLength(20);
          this.getView().getModel("viewModel").setProperty("/selectedStdCode", null);
        }
      }
    },

    SS_EC_onStdCodeChange: function (oEvent) {
      utils._LCvalidateMandatoryField(oEvent);

      const oSource = oEvent.getSource();
      const oSelectedItem = oSource.getSelectedItem();
      const oMobileInput = this.getView().byId("SS_id_EmpMoF");

      if (oMobileInput) {
        oMobileInput.setValue(""); // Clear input
        oMobileInput.setValueState("None"); // Reset state

        if (oSelectedItem) {
          const sCountryCode = oSelectedItem.getAdditionalText();

          // store country code in viewModel
          this.getView().getModel("viewModel").setProperty("/selectedStdCode", sCountryCode);

          this.setMaxLengthForCountry(oMobileInput, sCountryCode);
        } else {
          oMobileInput.setMaxLength(20);
          this.getView().getModel("viewModel").setProperty("/selectedStdCode", null);
        }
      }
    },

    SS_ECII_onStdCodeChange: function (oEvent) {
      utils._LCvalidateMandatoryField(oEvent);

      const oSource = oEvent.getSource();
      const oSelectedItem = oSource.getSelectedItem();
      const oMobileInput = this.getView().byId("SS_id_EmpMoS");

      if (oMobileInput) {
        oMobileInput.setValue(""); // Clear input
        oMobileInput.setValueState("None"); // Reset state

        if (oSelectedItem) {
          const sCountryCode = oSelectedItem.getAdditionalText();

          // store country code in viewModel
          this.getView().getModel("viewModel").setProperty("/selectedStdCode", sCountryCode);

          this.setMaxLengthForCountry(oMobileInput, sCountryCode);
        } else {
          oMobileInput.setMaxLength(20);
          this.getView().getModel("viewModel").setProperty("/selectedStdCode", null);
        }
      }
    },

    setMaxLengthForCountry: function (oControl, sCountryCode) {
      if (sCountryCode === "IN") {
        oControl.setMaxLength(10);
      } else {
        oControl.setMaxLength(20);
      }
    },

    validateNumberInput: function (oEventOrControl, sStdComboId) {
      // Support both: event OR control
      const oInput = (oEventOrControl && oEventOrControl.getSource && oEventOrControl.getSource()) || oEventOrControl;

      if (!oInput) return false;

      let sValue = oInput.getValue().replace(/[^0-9]/g, "");
      oInput.setValue(sValue);

      const oView = this.getView && this.getView();
      const oStdCombo = (oView && oView.byId && sStdComboId && oView.byId(sStdComboId)) || (sStdComboId && sap.ui.getCore().byId(sStdComboId)) || null;

      let sStdCode = null;
      if (oStdCombo) {
        sStdCode = oStdCombo.getSelectedKey() || (oStdCombo.getSelectedItem() && oStdCombo.getSelectedItem().getText()) || oStdCombo.getValue() || null;
      }

      const iMaxLength = sStdCode === "+91" ? 10 : 20;
      oInput.setMaxLength(iMaxLength);

      // --- Validation ---
      if (iMaxLength === 10) {
        if (sValue.length !== 10) {
          oInput.setValueState("Error");
          oInput.setValueStateText("Number must be exactly 10 digits.");
          return false;
        }
        if (sValue.startsWith("0")) {
          oInput.setValueState("Error");
          oInput.setValueStateText("Number cannot start with 0.");
          return false;
        }
        oInput.setValueState("None");
      } else {
        if (sValue.length < 4 || sValue.length > 20) {
          oInput.setValueState("Error");
          oInput.setValueStateText("Number must be between 4 and 20 digits.");
          return false;
        } else {
          oInput.setValueState("None");
        }
      }

      return true;
    },

    SS_onBaseLocationChange: function (oEvent) {
      utils._LCstrictValidationComboBox(oEvent.getSource(), "ID");
      this.handleBaseLocationChange(
        oEvent,
        "BaseLocationModel", // Source model
        "sEmployeeModel", // Target model
        "/0/CompanyCode" // Path in target model
      );
    },

    updateFunctionForSelf: function (oPayload, ID) {
      var oView = this.getView();
      // Add state to payload data if needed (optional)
      const oStateCombo = this.byId("SS_id_State");
      if (oStateCombo && oStateCombo.getSelectedKey()) {
        oPayload.data.State = oStateCombo.getSelectedKey();
      }
      this.ajaxUpdateWithJQuery("EmployeeDetails", oPayload)
        .then((oData) => {
          if (oData.success) {
            if (ID === "Submit") {
              this.ViewModel.setProperty("/SelfService", false);
            }
            MessageToast.show(this.i18nModel.getText("dataSaved"));
            oView.getModel("viewModel").setProperty("/isEditMode", false);
            oView.getModel("viewModel").setProperty("/AdminRole", false);
            this.getView().getModel("CompanyCodeDetailsModel")?.refresh(true);

            // Refresh employee data from server
            this._fetchCommonData("EmployeeDetails", "sEmployeeModel", {
              EmployeeID: this.EmployeeID,
            });
            this.byId("SS_id_Passport").setValueState("None");
            this.byId("SS_id_Voterid").setValueState("None");
          } else {
            MessageToast.show(this.i18nModel.getText("commonErrorMessage"));
          }
          this.closeBusyDialog();
          sap.ui.core.BusyIndicator.hide(0);
        })
        .catch((oError) => {
          this.closeBusyDialog();
          MessageToast.show(oError.responseText || oError.message);
        });
    },

    _onRouteMatched: async function (oEvent) {
      try {
        var LoginFUnction = await this.commonLoginFunction("SelfService");
        if (!LoginFUnction) return;
        this.initializeBirthdayCarousel();
        this.getBusyDialog();
        const oView = this.getView();
        this.i18nModel = oView.getModel("i18n").getResourceBundle();
        this.companyName = "Kalpavriksha Technologies";
        // --- Initialization ---
        this._makeDatePickersReadOnly(["SS_id_Dob", "SS_id_ResgEndDate", "SS_id_DocType"]);
        const viewModel = new sap.ui.model.json.JSONModel({
          fragmentSave: false,
          fragmentSubmit: false,
          isEditMode: false,
          isExperienced: false,
          employeeType: null,
          EmployeeStatus: false,
          isRoleMode: false,
          Max: new Date(),
          TraineeRole: false,
          Letter: false,
          ResignationVisible: false,
          CanWithdrawResignation: false,
          ShowStatusControl: false,
          isContractorRole: false,
          isVisitMode: true,
          isIdMode: true,
          isEditButtonVisible: true,
          PhotoSave: true,
          PhotoSubmit: false,
          BtnVisible: true,
          AdminRole: false,
          RelievingLetter: false,
          SelfService: false,
          min: new Date(),
          SetProfile: false,
          SalarySectionVisible: false,
          WorkCompletedVisible: false,
          editableResignatin: false,
          editableWithdrawComment: false,
          isWithdrawMode: false,
          commentLabel: this.i18nModel.getText("resignComment"),
          closeButtonText: this.i18nModel.getText("close"),
          SelfServiceBtn: false,
          isPayslipDownloadable: false
        });
        oView.setModel(viewModel, "viewModel");
        this.ViewModel = this.getView().getModel("viewModel");
        await this._fetchCommonData("EmployeeDetailsData", "empModel");
        // --- Role and Path Determination ---
        const loginModel = this.getOwnerComponent().getModel("LoginModel");
        const sLoggedInRole = loginModel.getProperty("/Role");
        this.sNavigatedRole = oEvent.getParameter("arguments").Role;
        this.sPath = oEvent.getParameter("arguments").sPath;

        //  decide icon based on sPath value
        if (this.sPath === "SelfService") {
          this._setHeaderButtonIcon("home");
        } else {
          this._setHeaderButtonIcon("back");
        }
        const bIsTrainee = sLoggedInRole === "Trainee" || this.sNavigatedRole === "Trainee";
        this.ViewModel.setProperty("/TraineeRole", bIsTrainee);
        const bIsContractor = sLoggedInRole === "Contractor" || this.sNavigatedRole === "Contractor";
        this.ViewModel.setProperty("/isContractorRole", bIsContractor);
        this.ViewModel.setProperty("/ShowStatusControl", ["Admin", "HR Manager", "HR"].includes(sLoggedInRole));
        this.ViewModel.setProperty("/ResignationVisible", this.sPath === "SelfService" && !bIsTrainee && !bIsContractor);
        var aIds = ["SS_id_ldob", "SS_id_lb", "SS_id_lpa", "SS_id_lca", "SS_id_Lmo", "SS_id_lr", "SS_id_les", "SS_id_Pf", "SS_id_lName", "SS_id_Rf", "SS_id_Mf", "SS_id_Af", "SS_id_Ps", "SS_idEmeSalS", "SS_id_lN", "SS_id_Ms", "SS_id_As", "SS_id_An", "SS_id_Ah", "SS_id_Bn", "SS_id_Bb", "SS_id_Ifc", "SS_id_Ba", "SS_id_LPan", "SS_id_LAdhar"];
        if (this.sPath === "SelfService") {
          this.ViewModel.setProperty("/SelfServiceBtn", true);
          this.getView().getModel("LoginModel").setProperty("/HeaderName", this.i18nModel.getText("tileSelfSerciceFooter"));
          this.ViewModel.setProperty("/SetProfile", true);
          if (loginModel) this.EmployeeID = loginModel.getProperty("/EmployeeID");
          aIds.forEach(
            function (sId) {
              this.byId(sId).setRequired(true);
            }.bind(this)
          );
          this.byId("SS_id_lc").setRequired(false);
          this.byId("SS_id_lbase").setRequired(false);
          this.byId("SS_id_lds").setRequired(false);
          this.byId("SS_id_Lmg").setRequired(false);
        } else {
          this.ViewModel.setProperty("/SelfServiceBtn", false);
          this.EmployeeID = this.sPath;
          this.byId("SS_id_lc").setRequired(true);
          this.byId("SS_id_lbase").setRequired(true);
          this.byId("SS_id_Lmg").setRequired(true);
          this.getView().getModel("LoginModel").setProperty("/HeaderName", this.i18nModel.getText("headerEmpDetails"));
          this.ViewModel.setProperty("/Letter", ["Admin", "HR Manager", "HR"].includes(sLoggedInRole) && !bIsTrainee && !bIsContractor);
          this.ViewModel.setProperty("/RelievingLetter", ["Admin", "HR Manager", "HR"].includes(loginModel.getProperty("/Role")));
          aIds.forEach(
            function (sId) {
              this.byId(sId).setRequired(false);
            }.bind(this)
          );
        }
        var employeeModel = new JSONModel();
        this.getOwnerComponent().setModel(employeeModel, "employeeModel");
        // --- Data Loading and UI Updates based on Data ---
        if (this.EmployeeID) {
          await this._fetchCommonData("EmployeeDetails", "sEmployeeModel", {
            EmployeeID: this.EmployeeID,
          });
          oView.getModel("sEmployeeModel").refresh(true);
          var oModelAllData = this.getView().getModel("sEmployeeModel").getData()[0];

          if (oModelAllData) {
            this._previousEmployeeStatus = oModelAllData.EmployeeStatus;
            const oRadioGroup = this.byId("SS_experienceRadioGroup");
            const bIsFresher = oModelAllData.EmployeeType === "Fresher";
            this.ViewModel.setProperty("/employmentSectionVisible", !bIsFresher);
            if (bIsFresher) {
              oRadioGroup.setSelectedIndex(0); // Select "Fresher"
              this.ViewModel.setProperty("/employeeType", "Fresher");
            } else if (oModelAllData.EmployeeType === "Experienced") {
              oRadioGroup.setSelectedIndex(1); // Select "Experienced"
              this.ViewModel.setProperty("/employeeType", "Experienced");
            } else {
              oRadioGroup.setSelectedIndex(-1); // No selection
              this.ViewModel.setProperty("/employeeType", null);
            }
            if (this.sPath === "SelfService" && oModelAllData.Type !== "Submit") {
              this.ViewModel.setProperty("/SelfService", true);
            }
            if (!oModelAllData.EContactIStdCode) oModelAllData.EContactIStdCode = "+91";
            if (!oModelAllData.EContactIIStdCode) oModelAllData.EContactIIStdCode = "+91";

            // --- Releving letter Button Visibility Logic ---
            if (this.sPath !== "SelfService" && ["Admin", "HR Manager", "HR"].includes(sLoggedInRole) && !bIsTrainee && !bIsContractor) {
              this.byId("SS_id_Action").setVisible(true);
              if (oModelAllData.EmployeeStatus === "Inactive") {
                this.ViewModel.setProperty("/WorkCompletedVisible", true);
                this.ViewModel.setProperty("/Letter", false);
                this.ViewModel.setProperty("/isVisitMode", false);
                this.ViewModel.setProperty("/RelievingLetter", false);
              } else if (oModelAllData.EmployeeStatus === "Active") {
                this.ViewModel.setProperty("/WorkCompletedVisible", false);
                this.ViewModel.setProperty("/isVisitMode", true);
                this.ViewModel.setProperty("/Letter", true);
              }
            } else {
              this.ViewModel.setProperty("/WorkCompletedVisible", false);
              if (oModelAllData.EmployeeStatus === "Inactive") {
                this.byId("SS_id_Action").setVisible(false);
              }
            }
            const oObjectPage = this.byId("ObjectPageLayout");
            const oSection = this.byId("basicDetailsSection");
            if (oObjectPage && oSection) {
              oObjectPage.setSelectedSection(oSection.getId());
            }
            this.managerID = this.getView().getModel("sEmployeeModel").getProperty("/0/ManagerID");
          }
          this._applyCountryStateCityFilters();
        }
        var oTextModel = new JSONModel({ name: "" });
        this.getView().setModel(oTextModel, "TextDisplay");
        var oIdCardModel = this.getView().getModel("IdCardModel");
        if (oIdCardModel) {
          oIdCardModel.attachPropertyChange(this.onPressDisplayImageOnCanvas.bind(this));
        }
        this.byId("SS_id_EmeNameF").setValueState("None");
        this.byId("SS_idRelF").setValueState("None");
        this.byId("SS_id_EmpMoF").setValueState("None");
        this.byId("SS_id_AddF").setValueState("None");
        this.byId("SS_id_NameS").setValueState("None");
        this.byId("SS_idRelS").setValueState("None");
        this.byId("SS_id_EmpMoS").setValueState("None");
        this.byId("SS_id_PAddress").setValueState("None");
        this.byId("SS_id_Manager").setValueState("None");
        this.byId("SS_id_BloodGroup").setValueState("None");
        this.byId("SS_id_CAdress").setValueState("None");
        this.byId("SS_id_EmpAddS").setValueState("None");
        this.byId("SS_id_MobileNo").setValueState("None");
        this.byId("SS_id_STDCode").setValueState("None");
        this.byId("SS_id_STDCodeRI").setValueState("None");
        this.byId("SS_id_STDCodeRII").setValueState("None");
        this.byId("SS_id_FatherName").setValueState("None");
        this.byId("SS_id_Compmail").setValueState("None");
        this.byId("SS_id_Country").setValueState("None");
        this.byId("SS_id_State").setValueState("None");
        this.byId("SS_id_BaseL").setValueState("None");
      } catch (error) {
        MessageToast.show(error.message || error.responseText);
      } finally {
        this.closeBusyDialog();
      }
      this.oModel = this.getView().getModel("PaySlip");
      this._currentSection = this.byId("ObjectPageLayout").getSelectedSection();
      this.getView().getModel("CompanyCodeDetailsModel").getData()

    },
    _applyCountryStateCityFilters: function () {
      const oModel = this.getView().getModel("sEmployeeModel");
      const oCountryCB = this.byId("SS_id_Country");
      const oStateCB = this.byId("SS_id_State");
      const oSourceCB = this.byId("SS_id_BaseL");

      const sCountry = oModel.getProperty("/0/Country");      // e.g. "Australia"
      const sState = oModel.getProperty("/0/State");        // e.g. "Queensland"
      const sSource = oModel.getProperty("/0/BaseLocation"); // e.g. "Bongaree"

      // Get bindings safely
      const oStateBinding = oStateCB?.getBinding("items");
      const oSourceBinding = oSourceCB?.getBinding("items");

      // Reset filters if bindings exist
      if (oStateBinding) {
        oStateBinding.filter([]);
      }
      if (oSourceBinding) {
        oSourceBinding.filter([]);
      }

      if (sCountry) {
        const aCountryData = this.getView().getModel("CountryModel")?.getData() || [];
        const oCountryObj = aCountryData.find(c => c.countryName === sCountry);

        if (oCountryObj) {
          const sCountryCode = oCountryObj.code;

          // Filter States by CountryCode
          if (oStateBinding) {
            oStateBinding.filter([
              new sap.ui.model.Filter("countryCode", sap.ui.model.FilterOperator.EQ, sCountryCode)
            ]);
          }

          // Filter Cities by State + CountryCode
          if (sState && oSourceBinding) {
            oSourceBinding.filter([
              new sap.ui.model.Filter("stateName", sap.ui.model.FilterOperator.EQ, sState),
              new sap.ui.model.Filter("countryCode", sap.ui.model.FilterOperator.EQ, sCountryCode)
            ]);
          }
        }
      }

      // Restore selection back in UI
      if (oCountryCB) {
        oCountryCB.setSelectedKey(sCountry || "");
      }
      if (oStateCB) {
        oStateCB.setSelectedKey(sState || "");
      }
      if (oSourceCB) {
        oSourceCB.setSelectedKey(sSource || "");
      }
    },

    _setHeaderButtonIcon: function (sType) {
      var oPage = this.byId("SelfService_id_page");
      if (!oPage) return;

      var aHeaderContent = oPage.getHeaderContent();
      if (!aHeaderContent || aHeaderContent.length === 0) return;

      var oBackBtn = null;
      for (var i = 0; i < aHeaderContent.length; i++) {
        if (aHeaderContent[i].isA("sap.m.Button")) {
          oBackBtn = aHeaderContent[i];
          break;
        }
      }

      if (oBackBtn) {
        if (sType === "home") {
          oBackBtn.setIcon("sap-icon://home");
          oBackBtn.setTooltip(this.i18nModel.getText("toolHome"));
        } else {
          oBackBtn.setIcon("sap-icon://nav-back");
          oBackBtn.setTooltip(this.i18nModel.getText("back"));
        }
      }
    },

    onSectionChange: async function (oEvent) {
      const viewModel = this.getView().getModel("viewModel");
      const oNewSection = oEvent.getParameter("section");
      const oCurrentSection = this._currentSection;

      oNewSection.getTitle() === 'Payslip' ? viewModel.setProperty("/isPayslipDownloadable", true) : viewModel.setProperty("/isPayslipDownloadable", false);
      // If in edit mode, show confirmation dialog
      if (viewModel.getProperty("/isEditMode")) {
        this.showConfirmationDialog(
          this.i18nModel.getText("confirmNavigationTitle"),
          this.i18nModel.getText("sectionChangeConfirm"),
          async () => {
            viewModel.setProperty("/isEditMode", false);
            this._currentSection = oNewSection;
            const sectionTitle = oNewSection.getTitle();

            switch (sectionTitle) {
              case "Basic Details":
                this.getBusyDialog();
                await this._fetchCommonData("EmployeeDetails", "sEmployeeModel", { EmployeeID: this.EmployeeID });
                this.getView().getModel("sEmployeeModel").refresh(true);
                // Reset the radio button state to match the loaded data
                const oModelAllData = this.getView().getModel("sEmployeeModel").getData()[0];
                if (oModelAllData) {
                  this.ViewModel.setProperty("/employeeType", oModelAllData.EmployeeType);
                  const oRadioGroup = this.byId("SS_experienceRadioGroup");
                  if (oRadioGroup) {
                    if (oModelAllData.EmployeeType === "Fresher") {
                      oRadioGroup.setSelectedIndex(0);
                    } else if (oModelAllData.EmployeeType === "Experienced") {
                      oRadioGroup.setSelectedIndex(1);
                    } else {
                      oRadioGroup.setSelectedIndex(-1);
                    }
                  }
                }
                this.closeBusyDialog();
                break;

              case "Salary Details":
                this.SS_readSalaryDetails(this.EmployeeID);
                break;

              case "Payslip":
                this.getBusyDialog();
                await this._commonGETCall("AdminPaySlip", "EmpTable", { EmployeeID: this.EmployeeID });
                this.closeBusyDialog();
                break;

              case "Document":
                ["SS_id_AcName", "SS_id_Acno", "SS_id_BankName", "SS_id_Branch", "SS_id_IfcsCode", "SS_id_Address", "SS_id_Pan", "SS_idAdhar", "SS_id_Passport", "SS_id_Voterid"].forEach((id) => this.byId(id)?.setValueState("None"));
                this.SS_readEducationalDetails(this.EmployeeID);
                this.SS_readEmploymentDetails(this.EmployeeID);
                break;

              case "Attachment":
                this.byId("SS_id_DocType")?.setValueState("None");
                this.ReadEmployeeDocument();
                break;
            }
          },
          () => {
            this.byId("ObjectPageLayout").setSelectedSection(oCurrentSection);
          },
          this.i18nModel.getText("OkButton"),
          this.i18nModel.getText("CancelButton")
        );
        return;
      }
      this._currentSection = oNewSection;
      const sectionTitle = oNewSection.getTitle();
      switch (sectionTitle) {
        case "Basic Details":
          this.getBusyDialog();
          await this._fetchCommonData("EmployeeDetails", "sEmployeeModel", { EmployeeID: this.EmployeeID });
          this.getView().getModel("sEmployeeModel").refresh(true);
          // Reset the radio button state to match the loaded data
          const oModelAllData = this.getView().getModel("sEmployeeModel").getData()[0];
          if (oModelAllData) {
            this.ViewModel.setProperty("/employeeType", oModelAllData.EmployeeType);
            const oRadioGroup = this.byId("SS_experienceRadioGroup");
            if (oRadioGroup) {
              if (oModelAllData.EmployeeType === "Fresher") {
                oRadioGroup.setSelectedIndex(0);
              } else if (oModelAllData.EmployeeType === "Experienced") {
                oRadioGroup.setSelectedIndex(1);
              } else {
                oRadioGroup.setSelectedIndex(-1);
              }
            }
          }
          this.closeBusyDialog();
          break;
        case "Salary Details":
          this.SS_readSalaryDetails(this.EmployeeID);
          break;
        case "Payslip":
          this.getBusyDialog();
          await this._commonGETCall("AdminPaySlip", "EmpTable", { EmployeeID: this.EmployeeID });
          this.closeBusyDialog();
          break;
        case "Document":
          this.byId("SS_id_AcName").setValueState("None");
          this.byId("SS_id_Acno").setValueState("None");
          this.byId("SS_id_BankName").setValueState("None");
          this.byId("SS_id_Branch").setValueState("None");
          this.byId("SS_id_IfcsCode").setValueState("None");
          this.byId("SS_id_Address").setValueState("None");
          this.byId("SS_id_Pan").setValueState("None");
          this.byId("SS_idAdhar").setValueState("None");
          this.byId("SS_id_Passport").setValueState("None");
          this.byId("SS_id_Voterid").setValueState("None");
          this.SS_readEducationalDetails(this.EmployeeID);
          this.SS_readEmploymentDetails(this.EmployeeID);
          break;
        case "Attachment":
          this.byId("SS_id_DocType").setValueState("None");
          this.byId("SS_id_DocType").setValue("");
          this.ReadEmployeeDocument();
          break;
      }
    },
    _getRequiredDocumentTypeForDegree: function (sDegreeName) {
      if (sDegreeName === "School/10th") {
        return "School/10th";
      }
      if (sDegreeName === "PUC/12th") {
        return "PUC/12th";
      }
      if (this.UG_DEGREES.includes(sDegreeName)) {
        return "UG Degree Certificate";
      }
      if (this.PG_DEGREES.includes(sDegreeName)) {
        return "PG Degree Certificate";
      }
      return sDegreeName;
    },
    onOpenActionBtn: function (oEvent) {
      var oBtn = oEvent.getSource();
      if (!this._oActionBtn) {
        this._oActionBtn = sap.ui.xmlfragment("sap.kt.com.minihrsolution.fragment.SelfServiceActionDialog", this);
        this.getView().addDependent(this._oActionBtn);
      }
      this._oActionBtn.openBy(oBtn);
    },
    SS_readEducationalDetails: async function (filter, showBusy = true) {
      try {
        if (showBusy) {
          this.getBusyDialog();
        }
        const oData = await this.ajaxReadWithJQuery("EducationalDetails", { EmployeeID: filter });
        const offerData = Array.isArray(oData.data) ? oData.data : [oData.data];
        const oModel = new JSONModel(offerData);
        this.getOwnerComponent().setModel(oModel, "sEducationModel");
        return oModel; // Return the model
      } catch (error) {
        MessageToast.show(error.message || error.responseText);
        return null; // Return null in case of error
      } finally {
        if (showBusy) {
          this.closeBusyDialog();
        }
      }
    },

    SS_readEmploymentDetails: async function (filter, showBusy = true) {
      try {
        if (showBusy) {
          this.getBusyDialog();
        }
        const oData = await this.ajaxReadWithJQuery("EmploymentDetails", { EmployeeID: filter });
        const offerData = Array.isArray(oData.data) ? oData.data : [oData.data];
        const oModel = new JSONModel(offerData);
        this.getOwnerComponent().setModel(oModel, "sEmploymentModel");
        return oModel; // Return the model
      } catch (error) {
        MessageToast.show(error.message || error.responseText);
        return null; // Return null in case of error
      } finally {
        if (showBusy) {
          this.closeBusyDialog();
        }
      }
    },
    SS_commonEduFunction() {
      var eduModel = new JSONModel({
        EmployeeID: this.EmployeeID,
        CollegeName: "",
        DegreeName: "",
        EducationStartDate: "",
        EducationEndDate: "",
        Grade: "",
        GradeType: "",
      });
      this.getView().setModel(eduModel, "educationModel");
    },
    SS_commonEmpFunction() {
      var empModel = new JSONModel({
        EmployeeID: this.EmployeeID,
        CompanyName: "",
        Designation: "",
        StartDate: "",
        EndDate: "",
        OfficeAddress: "",
        RCISal: "",
        RCIName: "",
        RCIAddress: "",
        RCIEmailID: "",
        RCISTDCode: "+91",
        RCIMobileNo: "",
        RCIISal: "",
        RCIIName: "",
        RCIIAddress: "",
        RCIIEmailID: "",
        RCIISTDCode: "+91",
        RCIIMobileNo: "",
      });
      this.getView().setModel(empModel, "employmentModel");
    },

    SS_validateCombo: function (oEvent) {
      utils._LCstrictValidationComboBox(oEvent);
    },
    SS_validateName: function (oEvent) {
      utils._LCvalidateName(oEvent);
    },
    SS_validateVoterId: function (oEvent) {
      utils._LCvalidateVoterId(oEvent);
    },
    SS_validateAadharCard: function (oEvent) {
      utils._LCvalidateAadharCard(oEvent);
    },
    SS_validatePassport: function (oEvent) {
      utils._LCvalidatePassport(oEvent);
    },
    SS_validatePanCard: function (oEvent) {
      utils._LCvalidatePanCard(oEvent);
    },
    SS_validateAccountNo: function (oEvent) {
      utils._LCvalidateAccountNo(oEvent);
    },
    SS_validateIfcCode: function (oEvent) {
      utils._LCvalidateIfcCode(oEvent);
    },
    SS_validateDate: function (oEvent) {
      utils._LCvalidateDate(oEvent);
    },
    SS_ValidateCommonFields: function (oEvent) {
      utils._LCvalidateMandatoryField(oEvent);
    },
    Emp_onDesignationChange: function (oEvent) {
      utils._LCvalidateMandatoryField(oEvent);
    },
    oEmpStartDateChange: function (oEvent) {
      utils._LCvalidateDate(oEvent);
    },
    SS_validateEmail: function (oEvent) {
      utils._LCvalidateEmail(oEvent);
    },
    SS_validateGrade: function (oEvent) {
      var sGradeTypeId = "AddEd_id_GradeType";
      var oGradeField = oEvent.getSource();
      if (oGradeField && sap.ui.getCore().byId(sGradeTypeId)) {
        utils._LCvalidateGrade(oGradeField, "ID", sGradeTypeId);
      }
    },
    SS_validateGradeType: function () {
      var oGradeField = sap.ui.getCore().byId("AddEd_id_Grade");
      if (oGradeField) {
        utils._LCvalidateGrade(oGradeField, "ID", "AddEd_id_GradeType");
      }
    },

    FSA_onNomineNameLiveChange: function (oEvent) {
      // utils._LCvalidateMandatoryField(oEvent);
      utils._LCvalidateName(oEvent);
    },

    FAA_onDateChange: function (oEvent) {
      utils._LCvalidateDate(oEvent);
    },
    // Edit button visibility with role-based access control and SelfService
    SS_onEditPress: function (oEvent) {
      var isEditMode = this.getView().getModel("viewModel").getProperty("/isEditMode");
      var Role = this.getView().getModel("LoginModel").getProperty("/Role");
      var allowedRoles = ["Admin", "HR Manager", "HR"];
      // Allow all users to edit in SelfService mode
      if (this.sPath === "SelfService") {
        if (isEditMode) {
          if (this.SS_onSavePress(oEvent.getSource().getId().split("--").pop())) {
            this.getView().getModel("viewModel").setProperty("/isEditMode", false);
          }
        } else {
          this.getView().getModel("viewModel").setProperty("/isEditMode", true);
          this.getView().getModel("viewModel").setProperty("/AdminRole", false);
        }
        return;
      }
      // Role-based edit for other cases
      if (isEditMode) {
        if (this.SS_onSavePress(oEvent.getSource().getId().split("--").pop())) {
          this.getView().getModel("viewModel").setProperty("/isEditMode", false);
        }
      } else {
        if (allowedRoles.includes(Role)) {
          this.getView().getModel("viewModel").setProperty("/isEditMode", true);
          this.getView().getModel("viewModel").setProperty("/AdminRole", ["Admin", "HR Manager", "HR"].includes(Role));
        } else {
          sap.m.MessageToast.show(this.i18nModel.getText("permissionDenied"));
        }
      }
    },
    SS_onCompanyChange: function (oEvent) {
      utils._LCstrictValidationComboBox(oEvent);

      const oComboBox = oEvent.getSource();
      const sSelectedCompanyCode = oComboBox.getSelectedKey() || oComboBox.getValue();

      const oCompanyModel = this.getView().getModel("CompanyCodeDetailsModel");
      const aCompanyData = oCompanyModel.getData() || [];

      // Find selected company object by companyCode
      const oSelectedCompany = aCompanyData.find(item => item.companyCode === sSelectedCompanyCode);

      const oEmployeeModel = this.getView().getModel("sEmployeeModel");
      if (oSelectedCompany) {
        oEmployeeModel.setProperty("/0/CompanyCode", oSelectedCompany.companyCode);
        oEmployeeModel.setProperty("/0/BranchCode", oSelectedCompany.branchCode || "");
        oEmployeeModel.setProperty("/0/Branch", oSelectedCompany.branch || "");
      } else {
        oEmployeeModel.setProperty("/0/CompanyCode", "");
        oEmployeeModel.setProperty("/0/Branch", "");
      }
    },


    _validateAllRequiredFieldsForSubmit: function () {
      const oView = this.getView();
      const bIsValid =
        // --- Basic Details Section ---
        utils._LCvalidateDate(oView.byId("SS_id_Dob"), "ID") &&
        utils._LCstrictValidationComboBox(oView.byId("SS_id_BloodGroup"), "ID") &&
        utils._LCvalidateMandatoryField(oView.byId("SS_id_PAddress"), "ID") &&
        utils._LCvalidateMandatoryField(oView.byId("SS_id_CAdress"), "ID") &&
        utils._LCstrictValidationComboBox(oView.byId("SS_id_STDCode"), "ID") &&
        //  this.validateNumberInput(oView.byId("SS_id_MobileNo"), "ID") &&
        this.validateNumberInput(oView.byId("SS_id_MobileNo"), "SS_id_STDCode") &&
        // --- Emergency Contact 1 ---
        utils._LCvalidateName(oView.byId("SS_id_EmeNameF"), "ID") &&
        utils._LCstrictValidationComboBox(oView.byId("SS_id_STDCodeRI"), "ID") &&
        //  this.validateNumberInput(oView.byId("SS_id_EmpMoF"), "ID") &&
        this.validateNumberInput(oView.byId("SS_id_EmpMoF"), "SS_id_STDCodeRI") &&
        utils._LCvalidateMandatoryField(oView.byId("SS_id_AddF"), "ID") &&
        // --- Emergency Contact 2 ---
        utils._LCvalidateName(oView.byId("SS_id_NameS"), "ID") &&
        utils._LCstrictValidationComboBox(oView.byId("SS_id_STDCodeRII"), "ID") &&
        //  this.validateNumberInput(oView.byId("SS_id_EmpMoS"), "ID") &&
        this.validateNumberInput(oView.byId("SS_id_EmpMoS"), "SS_id_STDCodeRII") &&
        utils._LCvalidateMandatoryField(oView.byId("SS_id_EmpAddS"), "ID") &&
        // --- Bank Details Section ---
        utils._LCvalidateName(oView.byId("SS_id_AcName"), "ID") &&
        utils._LCvalidateAccountNo(oView.byId("SS_id_Acno"), "ID") &&
        utils._LCvalidateMandatoryField(oView.byId("SS_id_BankName"), "ID") &&
        utils._LCvalidateMandatoryField(oView.byId("SS_id_Branch"), "ID") &&
        utils._LCvalidateIfcCode(oView.byId("SS_id_IfcsCode"), "ID") &&
        utils._LCvalidateMandatoryField(oView.byId("SS_id_Address"), "ID") &&
        // --- Personal IDs Section ---
        utils._LCvalidatePanCard(oView.byId("SS_id_Pan"), "ID") &&
        utils._LCvalidateAadharCard(oView.byId("SS_idAdhar"), "ID");

      return bIsValid;
    },
    onPressSubmit: async function (oEvent) {
      const that = this;
      if (!this._validateAllRequiredFieldsForSubmit()) {
        MessageToast.show(this.i18nModel.getText("mandetoryFields"));
        return;
      }

      this.getBusyDialog();
      try {
        const sEmployeeType = this.ViewModel.getProperty("/employeeType");
        if (!sEmployeeType) {
          MessageToast.show(this.i18nModel.getText("experienceSelectionRequired"));
          this.closeBusyDialog();
          return;
        }
        const bIsExperienced = sEmployeeType === "Experienced";
        // --- 1. Validate Education Data ---
        const oEducationModel = await this.SS_readEducationalDetails(this.EmployeeID, false);
        const aEducationData = oEducationModel ? oEducationModel.getData() : [];
        if (aEducationData.length < 2) {
          MessageBox.error(this.i18nModel.getText("minEducationRecordsError"));
          this.closeBusyDialog();
          return;
        }
        if (!aEducationData.some((edu) => edu.DegreeName === "School/10th")) {
          MessageBox.error(this.i18nModel.getText("mandatory10thDegreeError"));
          this.closeBusyDialog();
          return;
        }
        // 2. Validate Employment Data (if experienced) ---
        if (bIsExperienced) {
          const oEmploymentModel = await this.SS_readEmploymentDetails(this.EmployeeID, false);
          if (!oEmploymentModel || oEmploymentModel.getData().length < 1) {
            MessageBox.error(this.i18nModel.getText("minEmploymentRecordError"));
            this.closeBusyDialog();
            return;
          }
        }
        // Base documents that are always required
        let aRequiredDocNames = ["Pan Card", "Aadhar Card", "Bank details"];
        // Determine required documents from the education records entered
        const aEducationDocRequirements = aEducationData.map((edu) => {
          return this._getRequiredDocumentTypeForDegree(edu.DegreeName);
        });
        // Add the unique education document requirements to our list
        aRequiredDocNames = [...new Set([...aRequiredDocNames, ...aEducationDocRequirements])];
        // Add experience-based documents if needed
        if (bIsExperienced) {
          aRequiredDocNames.push("Previous Company Relieving Letter", "Previous Company 3 Months Payslip");
        }
        // Get the list of currently uploaded documents
        await this.ReadEmployeeDocument(false);
        const aUploadedDocs = this.getView().getModel("DocumentModel").getProperty("/items") || [];
        const aUploadedDocTypes = aUploadedDocs.map((doc) => doc.DocumentType);
        // Find which required documents are missing
        const aMissingDocs = [...new Set(aRequiredDocNames)].filter((doc) => !aUploadedDocTypes.includes(doc));
        if (aMissingDocs.length > 0) {
          const sMissingDocsList = aMissingDocs.join(", ");
          MessageBox.error(this.i18nModel.getText("mandatoryDocumentsErrorText", [sMissingDocsList]));
          this.closeBusyDialog();
          return;
        }
        // --- 4. If all validations pass, proceed to save ---
        const ID = oEvent.getSource().getId().split("--").pop();
        that.SS_onSavePress(ID);
      } catch (error) {
        MessageToast.show("An error occurred during validation. Please try again.");
      } finally {
        this.closeBusyDialog();
      }
    },

    onChangeResigEndDate: function (oEvent) {
      utils._LCvalidateDate(oEvent);
    },

    SS_onSavePress: function (sButtonId) {
      const oView = this.getView();
      const oDataModel = oView.getModel("sEmployeeModel").getData()[0];
      let isValid = true;
      let sMessage = this.i18nModel.getText("selfServiceUpdateAdmin");
      if (this.sNavigatedRole === "Contractor" && this._previousEmployeeStatus === "Inactive" && oDataModel.EmployeeStatus === "Active") {
        MessageToast.show(this.i18nModel.getText("inactiveContractorError"));
        return false;
      }
      if (!["Trainee", "Contractor"].includes(this.sNavigatedRole) && sButtonId !== "Submit" && oDataModel.EmployeeStatus === "Inactive" && !oView.byId("SS_id_ResgEndDate").getValue()) {
        MessageToast.show(this.i18nModel.getText("resignationEndDateRequired"));
        return false;
      }
      // --- Section 1: All Validation Logic ---
      if (this.sPath === "SelfService") {
        sMessage = this.i18nModel.getText("selfServiceUpdateEmployee");
        if (sButtonId === "BasicDetailsBtn") {
          const sEmployeeType = this.ViewModel.getProperty("/employeeType");
          if (!sEmployeeType) {
            MessageToast.show(this.i18nModel.getText("experienceSelectionRequired"));
            return false; // Stop the save process
          }
          // Basic Details & Emergency Contacts Validation
          isValid =
            utils._LCvalidateDate(oView.byId("SS_id_Dob"), "ID") &&
            utils._LCstrictValidationComboBox(oView.byId("SS_id_BloodGroup"), "ID") &&
            utils._LCvalidateMandatoryField(oView.byId("SS_id_PAddress"), "ID") &&
            utils._LCvalidateMandatoryField(oView.byId("SS_id_CAdress"), "ID") &&
            utils._LCstrictValidationComboBox(oView.byId("SS_id_STDCode"), "ID") &&
            // this.validateNumberInput(oView.byId("SS_id_MobileNo"), "ID") &&
            this.validateNumberInput(oView.byId("SS_id_MobileNo"), "SS_id_STDCode") &&
            utils._LCvalidateEmail(oView.byId("SS_id_Compmail"), "ID") &&
            utils._LCvalidateName(oView.byId("SS_id_EmeNameF"), "ID") &&
            utils._LCstrictValidationComboBox(oView.byId("SS_id_STDCodeRI"), "ID") &&
            //  this.validateNumberInput(oView.byId("SS_id_EmpMoF"), "ID") &&
            this.validateNumberInput(oView.byId("SS_id_EmpMoF"), "SS_id_STDCodeRI") &&
            utils._LCvalidateMandatoryField(oView.byId("SS_id_AddF"), "ID") &&
            utils._LCvalidateName(oView.byId("SS_id_NameS"), "ID") &&
            utils._LCstrictValidationComboBox(oView.byId("SS_id_STDCodeRII"), "ID") &&
            //  this.validateNumberInput(oView.byId("SS_id_EmpMoS"), "ID") &&
            this.validateNumberInput(oView.byId("SS_id_EmpMoS"), "SS_id_STDCodeRII") &&
            utils._LCvalidateMandatoryField(oView.byId("SS_id_EmpAddS"), "ID") &&
            utils._LCvalidateMandatoryField(oView.byId("SS_id_Desi"), "ID");
        } else if (sButtonId === "DocumentBtn") {
          // Bank Details & Personal IDs Validation
          isValid = utils._LCvalidateName(oView.byId("SS_id_AcName"), "ID") && utils._LCvalidateAccountNo(oView.byId("SS_id_Acno"), "ID") && utils._LCvalidateMandatoryField(oView.byId("SS_id_BankName"), "ID") && utils._LCvalidateMandatoryField(oView.byId("SS_id_Branch"), "ID") && utils._LCvalidateIfcCode(oView.byId("SS_id_IfcsCode"), "ID") && utils._LCvalidateMandatoryField(oView.byId("SS_id_Address"), "ID") && utils._LCvalidatePanCard(oView.byId("SS_id_Pan"), "ID") && utils._LCvalidateAadharCard(oView.byId("SS_idAdhar"), "ID");
        }
      } else {
        // Admin/HR Edit Validation
        const isRequiredValid = utils._LCvalidateEmail(oView.byId("SS_id_Compmail"), "ID") && utils._LCstrictValidationComboBox(oView.byId("SS_id_Country"), "ID") && utils._LCstrictValidationComboBox(oView.byId("SS_id_State"), "ID") && utils._LCstrictValidationComboBox(oView.byId("SS_id_BaseL"), "ID") && utils._LCstrictValidationComboBox(oView.byId("SS_id_Manager"), "ID");

        const passport = oView.byId("SS_id_Passport").getValue().trim();
        const voterId = oView.byId("SS_id_Voterid").getValue().trim();
        const isOptionalValid = (passport === "" || utils._LCvalidatePassport(oView.byId("SS_id_Passport"), "ID")) && (voterId === "" || utils._LCvalidateVoterId(oView.byId("SS_id_Voterid"), "ID")) && (oDataModel.EmployeeStatus === "Inactive" && !["Trainee", "Contractor"].includes(this.sNavigatedRole) ? utils._LCvalidateDate(oView.byId("SS_id_ResgEndDate"), "ID") : true);

        isValid = isRequiredValid && isOptionalValid;
      }
      // --- Section 2: Check Validation Result ---
      if (!isValid) {
        MessageToast.show(this.i18nModel.getText("mandetoryFields"));
        return false; // Stop if validation failed
      }

      // --- Section 3: Prepare Data for Payload ---
      oDataModel.EmployeeType = this.ViewModel.getProperty("/employeeType");
      if (sButtonId === "Submit") {
        oDataModel.Type = "Submit";
        sMessage = this.i18nModel.getText("confirmSubmitMessage");
      } else {
        oDataModel.DateOfBirth = oView.byId("SS_id_Dob").getValue().split("/").reverse().join("-");
        oDataModel.EmergencyContactPerson1Salutation = oView.byId("SS_idEmeSalF").getSelectedKey();
        oDataModel.EmergencyContactPerson2Salutation = oView.byId("SS_idEmeSalS").getSelectedKey();
        oDataModel.EmergencyContactPerson1Realtion = oView.byId("SS_idRelF").getSelectedKey();
        oDataModel.EmergencyContactPerson2Realtion = oView.byId("SS_idRelS").getSelectedKey();
      }

      const oPayload = {
        data: oDataModel,
        filters: { EmployeeID: this.EmployeeID },
      };

      // --- Section 4: Show Confirmation and Execute Save ---
      this.showConfirmationDialog(
        this.i18nModel.getText("confirmTitle"),
        sMessage,
        function () {
          this.getBusyDialog();
          this.updateFunctionForSelf(oPayload, sButtonId);
        }.bind(this)
      );
      return true;
    },

    onManagerChange: function (oEvent) {
      utils._LCvalidateMandatoryField(oEvent.getSource(), "ID");
      const oDataModel = this.getView().getModel("sEmployeeModel").getProperty("/0");
      const requestData = { ManagerID: oDataModel.ManagerID, Status: "Submitted" };
      oDataModel.ManagerID = oEvent.getSource().getSelectedKey();
      oDataModel.ManagerName = oEvent.getSource().getSelectedItem() ? oEvent.getSource().getSelectedItem().getText() : oEvent.getSource().getValue();
      var oPayload = {
        data: oDataModel,
        filters: {
          EmployeeID: this.EmployeeID,
        },
      };
      if (!oDataModel.ManagerName && !oDataModel.ManagerID) {
        return;
      }
      this.getBusyDialog();
      var that = this;
      this.ajaxReadWithJQuery("InboxDetails", requestData)
        .then((oData) => {
          this.closeBusyDialog();
          if (oData.data && oData.data.length > 0 && this.managerID !== oDataModel.ManagerID) {
            MessageBox.show(this.getView().getModel("i18n").getResourceBundle().getText("managerChangeMsg"), {
              icon: sap.m.MessageBox.Icon.INFORMATION,
              title: "Confirmation",
              actions: [sap.m.MessageBox.Action.OK, "Cancle"],
              onClose: async function (sAction) {
                if (sAction === "OK") {
                  this.getBusyDialog();
                  // oData.ManagerID = managerId;
                  await this.updateFunctionForSelf(oPayload, "");
                  var flag = false;
                  for (let i = 0; i < oData.data.length; i++) {
                    oData.data[i].ManagerName = oPayload.data.ManagerName;
                    oData.data[i].ManagerID = oPayload.data.ManagerID;
                    oData.data[i].ManagerChanges = "Manager Changes";

                    const payLoad = {
                      data: oData.data[i],
                      filters: {
                        ID: oData.data[i].ID,
                      },
                    };
                    await this.ajaxUpdateWithJQuery("InboxDetails", payLoad)
                      .then((oData) => {
                        flag = true;
                      })
                      .catch((oError) => {
                        flag = false;
                        this.closeBusyDialog();
                        return;
                      })
                      .bind(this);
                  }
                  if (flag) {
                    // sap.m.MessageToast.show(this.getView().getModel("i18n").getResourceBundle().getText("managerUpdate"));
                  } else {
                    sap.m.MessageToast.show(this.getView().getModel("i18n").getResourceBundle().getText("commomerror"));
                  }
                  //sap.ui.core.BusyIndicator.hide(0);
                } else {
                  await this._fetchCommonData("EmployeeDetails", "sEmployeeModel", {
                    EmployeeID: this.EmployeeID,
                  }).then(async () => {
                    oPayload.data = that.getView().getModel("sEmployeeModel").getData()[0];
                    that.getView().byId("SS_id_Manager").setSelectedKey(oPayload.data.ManagerID);
                    //await that.updateFunctionForSelf(oPayload, "");
                  });
                  this.closeBusyDialog();
                }
              }.bind(this),
            });
          } else {
            this.getBusyDialog();
            this.updateFunctionForSelf(oPayload, "");
            // sap.ui.core.BusyIndicator.hide(0);
          }
        })
        .bind(this)
        .catch((oError) => {
          MessageToast.show(oError);
          this.closeBusyDialog();
        })
        .bind(this);
      this.getView().getModel("sEmployeeModel").refresh();
      this.byId("SS_id_Manager").setValueState("None");
    },
    setMinEndDate: function (sStartDateId, sEndDateId) {
      let oStartDatePicker = sap.ui.getCore().byId(sStartDateId);
      let oEndDatePicker = sap.ui.getCore().byId(sEndDateId);
      if (oStartDatePicker && oEndDatePicker) {
        let oStartDate = oStartDatePicker.getDateValue();
        let oEndDate = oEndDatePicker.getDateValue();
        oEndDatePicker.setMinDate(oStartDate);
        if (oEndDate && oEndDate < oStartDate) {
          oEndDatePicker.setDateValue(null);
        }
      }
    },
    onStartDateChange: function (oEvent) {
      this.setMinEndDate("AddEd_id_StartEdu", "AddEd_id_EndEdu");
      sap.ui.getCore().byId("AddEd_id_StartEdu").setValueState("None");
    },
    oEmpStartDateChange: function () {
      this.setMinEndDate("AddEmp_id_StartDate", "AddEmp_id_EndDate");
      sap.ui.getCore().byId("AddEmp_id_StartDate").setValueState("None");
    },

    SS_commonOpenDialog: function (dialogProperty, fragmentName, datePickerIds = []) {
      if (!this[dialogProperty]) {
        sap.ui.core.Fragment.load({
          name: fragmentName,
          controller: this,
        }).then((oDialog) => {
          this[dialogProperty] = oDialog;
          this.getView().addDependent(oDialog);
          this._FragmentDatePickersReadOnly(datePickerIds);
          oDialog.open();
        });
      } else {
        this._FragmentDatePickersReadOnly(datePickerIds);
        this[dialogProperty].open();
      }
    },

    EdF_AddEdu: function () {
      this.ViewModel.setProperty("/fragmentSubmit", true);
      this.ViewModel.setProperty("/fragmentSave", false);
      this.SS_commonEduFunction();
      this.SS_commonOpenDialog("SEd_oDialog", "sap.kt.com.minihrsolution.fragment.AddEducation", ["AddEd_id_StartEdu", "AddEd_id_EndEdu"]);
    },

    AddEd_onCloseDial: async function () {
      this.SEd_oDialog.close();
      this.byId("EdF_id_EduTable").removeSelections(true);
      const ids = ["AddEd_id_College", "AddEd_id_StartEdu", "AddEd_id_EndEdu", "AddEd_id_Grade"];
      ids.forEach((id) => {
        sap.ui.getCore().byId(id).setValueState("None");
      });
      await this._fetchCommonData("EducationalDetails", "sEducationModel", {
        EmployeeID: this.EmployeeID,
      });
    },

    AddEmp_onClose: function () {
      this.SEmp_oDialog.close();
      this.byId("EmpF_id_EmpTable").removeSelections(true);
      const ids = ["AddEmp_id_Company", "AddEmp_id_Desig", "AddEmp_id_OfcAddress", "AddEmp_id_StartDate", "AddEmp_id_EndDate", "AdEmp_id_RCNameI", "AdEmp_id_RCAddressI", "AdEmp_id_RCMailI", "AdEmp_id_RCMobileI", "AdEmp_id_RCSalII", "AdEmp_id_RCNameII", "AdEmp_id_RCAddressII", "AdEmp_id_RCMailII", "AdEmp_id_RCMobileII"];
      ids.forEach((id) => {
        sap.ui.getCore().byId(id).setValueState("None");
      });
      this._fetchCommonData("EmploymentDetails", "sEmploymentModel", { EmployeeID: this.EmployeeID });
    },

    EDF_EditEducation: function () {
      this.SS_commonEduFunction();
      var oSelectedItem = this.byId("EdF_id_EduTable").getSelectedItem();
      if (oSelectedItem) {
        var oData = oSelectedItem.getBindingContext("sEducationModel").getObject();
        this.getView().getModel("educationModel").setData(oData);
        this.ViewModel.setProperty("/fragmentSubmit", false);
        this.ViewModel.setProperty("/fragmentSave", true);
        this.SS_commonOpenDialog("SEd_oDialog", "sap.kt.com.minihrsolution.fragment.AddEducation", ["AddEd_id_StartEdu", "AddEd_id_EndEdu"]);
      } else {
        MessageToast.show(this.i18nModel.getText("selectRowUpdate"));
      }
    },

    EdF_DeletEdu: function () {
      var that = this;
      var oSelectedItem = this.byId("EdF_id_EduTable").getSelectedItem();
      if (!oSelectedItem) {
        sap.m.MessageToast.show(this.i18nModel.getText("selctRowtoDelete"));
        return;
      }
      var oContext = oSelectedItem.getBindingContext("sEducationModel").getProperty("ID");
      // Use common confirmation dialog
      this.showConfirmationDialog(
        this.i18nModel.getText("msgBoxConfirm"),
        this.i18nModel.getText("edudeletConfirmation"),
        function () {
          that.getBusyDialog();
          that
            .ajaxDeleteWithJQuery("/EducationalDetails", {
              filters: {
                ID: oContext,
              },
            })
            .then(() => {
              sap.m.MessageToast.show(that.i18nModel.getText("eduDataDeletSuucess"));
              that._fetchCommonData("EducationalDetails", "sEducationModel", { EmployeeID: that.EmployeeID });
              that.closeBusyDialog();
            })
            .catch((error) => {
              that.closeBusyDialog();
              sap.m.MessageToast.show(error.responseText);
            });
        },
        function () {
          // On Cancel
          that.closeBusyDialog();
          that.byId("EdF_id_EduTable").removeSelections(true);
        }
      );
    },

    EmpF_onAddEmployment: function () {
      this.ViewModel.setProperty("/fragmentSubmit", true);
      this.ViewModel.setProperty("/fragmentSave", false);
      this.SS_commonEmpFunction();
      this.SS_commonOpenDialog("SEmp_oDialog", "sap.kt.com.minihrsolution.fragment.AddEmployment", ["AddEmp_id_StartDate", "AddEmp_id_EndDate"]);
      setTimeout(() => {
        const oStartDatePicker = sap.ui.getCore().byId("AddEmp_id_StartDate");
        if (oStartDatePicker) {
          const latestEducationEndDate = this._getLatestEducationEndDate();
          if (latestEducationEndDate) {
            const minEmploymentStartDate = new Date(latestEducationEndDate);
            minEmploymentStartDate.setDate(minEmploymentStartDate.getDate() + 1);
            oStartDatePicker.setMinDate(minEmploymentStartDate);
          } else {
            oStartDatePicker.setMinDate(null);
          }
        }
        // sap.ui.getCore().byId("AddEmp_id_ExpTypeRadioGroup").setSelectedIndex(1);
      }, 300);
    },

    EmpF_onEditEmployment: function () {
      var oSelectedItem = this.byId("EmpF_id_EmpTable").getSelectedItem();
      if (oSelectedItem) {
        this.SS_commonEmpFunction();
        var oData = oSelectedItem.getBindingContext("sEmploymentModel").getObject();
        this.getView().getModel("employmentModel").setData(oData);
        this.ViewModel.setProperty("/fragmentSubmit", false);
        this.ViewModel.setProperty("/fragmentSave", true);
        this.SS_commonOpenDialog("SEmp_oDialog", "sap.kt.com.minihrsolution.fragment.AddEmployment", ["AddEmp_id_StartDate", "AddEmp_id_EndDate"]);
      } else {
        MessageToast.show(this.i18nModel.getText("selectRowUpdate"));
      }
    },

    EmpF_onDeletEmployment: function () {
      var that = this;
      var oSelectedItem = this.byId("EmpF_id_EmpTable").getSelectedItem();
      if (!oSelectedItem) {
        sap.m.MessageToast.show(this.i18nModel.getText("selctRowtoDelete"));
        return;
      }
      var oContext = oSelectedItem.getBindingContext("sEmploymentModel").getProperty("ID");
      // Show common confirmation dialog
      this.showConfirmationDialog(
        this.i18nModel.getText("msgBoxConfirm"),
        this.i18nModel.getText("empdeleteConfirmation"),
        function () {
          that.getBusyDialog();
          that
            .ajaxDeleteWithJQuery("/EmploymentDetails", {
              filters: {
                ID: oContext,
              },
            })
            .then(() => {
              sap.m.MessageToast.show(that.i18nModel.getText("empDataDeleteSuccess"));
              that._fetchCommonData("EmploymentDetails", "sEmploymentModel", { EmployeeID: that.EmployeeID });
              that.closeBusyDialog();
            })
            .catch((error) => {
              sap.m.MessageToast.show(error.responseText);
              that.closeBusyDialog();
            });
        },
        function () {
          that.byId("EmpF_id_EmpTable").removeSelections(true);
          that.closeBusyDialog();
        }
      );
    },
    onPressback: function (oEvent) {
      if (this.getView().getModel("viewModel").getProperty("/isEditMode")) {
        this.showConfirmationDialog(
          this.i18nModel.getText("ConfirmActionTitle"),
          this.i18nModel.getText("backConfirmation"),
          function () {
            if (this.sPath === "SelfService") {
              this.getRouter().navTo("RouteTilePage");
            } else {
              this.getRouter().navTo("RouteEmployeeDetails", { sPath: "SelfService" });
            }
          }.bind(this)
        );
      } else {
        if (this.sPath === "SelfService") {
          this.getRouter().navTo("RouteTilePage");
        } else {
          this.getRouter().navTo("RouteEmployeeDetails", { sPath: "SelfService" });
        }
      }
      if (this["SSReg_oDialog"]) {
        this["SSReg_oDialog"].close();
        this["SSReg_oDialog"].destroy();
        this["SSReg_oDialog"] = null;
      }
    },
    onLogout: function () {
      this.getRouter().navTo("LoginPage");
      this.CommonLogoutFunction();
    },

    onDocumentTypeChange: function (oEvent) {
      utils._LCvalidateMandatoryField(oEvent);
    },

    onBeforeUploadStarts: function (oEvent) {
      var oDocType = this.byId("SS_id_DocType");
      if (!utils._LCvalidateMandatoryField(oDocType, "ID") || !oDocType.getSelectedItem()) {
        MessageToast.show(this.i18nModel.getText("decumentType"));
        return;
      }
      var docTypeText = oDocType.getSelectedItem().getText();
      var oModel = this.getView().getModel("sEmployeeModel");
      var oFile = oEvent.getParameter("files")[0];
      var that = this;
      var aUploadedDocs = this.getView().getModel("DocumentModel")?.getProperty("/items") || [];
      var isAlreadyUploaded = aUploadedDocs.some(function (doc) {
        return doc.DocumentType === docTypeText;
      });
      if (isAlreadyUploaded) {
        MessageToast.show(this.i18nModel.getText("documentAlreadyUploaded"));
        return;
      }
      function uploadFile() {
        that.getBusyDialog();
        if (oFile) {
          var reader = new FileReader();
          reader.onload = function (e) {
            var base64 = e.target.result.split(",")[1];
            var sExtension = oFile.name.split('.').pop();
            var sCustomFileName = oModel.getData()[0].EmployeeID + "_" + docTypeText + "." + sExtension;
            var oPayload = {
              data: {
                DocumentType: docTypeText,
                EmployeeID: oModel.getData()[0].EmployeeID, 
                CreatedBy: that.getView().getModel("LoginModel").getData().EmployeeName,
                CreatedOn: new Date().toISOString(),
                File: base64,
                FileName: sCustomFileName,
                FileType: oFile.type,
              },
            };
            that
              .ajaxCreateWithJQuery("EmployeeDocument", oPayload)
              .then(function () {
                MessageToast.show("File upload sucessfully");
                that.ReadEmployeeDocument();
                that.byId("SS_id_DocType").setSelectedKey("");
              })
              .catch(function (err) {
                MessageToast.show("File upload failed");
                that.closeBusyDialog();
              });
          };
          reader.readAsDataURL(oFile);
        }
      }
      // Show warning dialog for specific document types
      if (docTypeText === "Previous Company 3 Months Payslip" || docTypeText === "UG Degree Certificate" || docTypeText === "PG Degree Certificate") {
        var sWarningMsg = "";
        if (docTypeText === "Previous Company 3 Months Payslip") {
          sWarningMsg = this.i18nModel.getText("mergeSalarySlipWarning");
        } else {
          sWarningMsg = this.i18nModel.getText("mergeSemesterDocWarning");
        }
        MessageBox.warning(sWarningMsg, {
          actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
          onClose: function (sAction) {
            if (sAction === MessageBox.Action.OK) {
              uploadFile();
            } else if (sAction === MessageBox.Action.CANCEL) {
              that.byId("SS_id_DocType").setSelectedKey("");
            }
          },
        });
        return;
      }
      uploadFile();
    },

    ReadEmployeeDocument: async function (showBusy = true) {
      try {
        if (showBusy) {
          this.getBusyDialog();
        }
        const oData = await this.ajaxReadWithJQuery("EmployeeDocument", { EmployeeID: this.EmployeeID });
        const offerData = Array.isArray(oData.data) ? oData.data : [oData.data];
        const wrappedData = {
          items: offerData,
        };
        this.getOwnerComponent().setModel(new JSONModel(wrappedData), "DocumentModel");
      } catch (error) {
        MessageToast.show(error.message || error.responseText);
      } finally {
        if (showBusy) {
          this.closeBusyDialog();
        }
      }
    },

    onDeleteFiles: function () {
      var that = this;
      this.showConfirmationDialog(
        that.i18nModel.getText("msgBoxConfirm"),
        that.i18nModel.getText("msgBoxConfirmDelete"),
        async function () {
          that.getBusyDialog();
          const ID = that.byId("table-uploadSet").getSelectedItem().getBindingContext("DocumentModel").getProperty("ID");
          try {
            await that.ajaxDeleteWithJQuery("/EmployeeDocument", {
              filters: { ID: ID },
            });
            MessageToast.show(that.i18nModel.getText("DocumentDeleteSuccess"));
            that.ReadEmployeeDocument();
            that.byId("downloadSelectedButton").setEnabled(false);
            that.byId("DeleteSelectedButton").setEnabled(false);
          } catch (error) {
            MessageToast.show(that.i18nModel.getText("DocumentDeleteError"));
          } finally {
            that.closeBusyDialog();
          }
        },
        function () {
          that.byId("table-uploadSet").removeSelections(true);
          that.byId("downloadSelectedButton").setEnabled(false);
          that.byId("DeleteSelectedButton").setEnabled(false);
        }
      );
    },

    onSelectionChange: function (oEvent) {
      this.byId("downloadSelectedButton").setEnabled(true);
      this.byId("DeleteSelectedButton").setEnabled(true);
    },

    onDownloadFiles: function (oEvent) {
      const oTable = this.byId("table-uploadSet");
      const oContexts = oTable.getSelectedContexts();
      if (oContexts && oContexts.length) {
        oContexts.forEach((oContext) => {
          const oData = oContext.getObject();
          const base64Data = oData.File; // Assuming base64 is in 'content'
          const mimeType = oData.FileType || "image/png"; // Default fallback
          const fileName = oData.FileName || "downloaded_image.png";

          // Create a blob and download
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], {
            type: mimeType,
          });
          // Trigger download
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          this.byId("downloadSelectedButton").setEnabled(false);
          this.byId("DeleteSelectedButton").setEnabled(false);
          this.byId("table-uploadSet").removeSelections(true);
        });
      }
    },

    openPreviewDocument: function (oEvent) {
      const oContext = oEvent.getSource().getBindingContext("DocumentModel");
      const oData = oContext.getObject();
      const sMimeType = oData.FileType || "image/png";
      const sBase64 = oData.File;
      const sFileName = "Document Preview";
      if (!this._oPreviewDialog) {
        this._oPreviewDialog = new sap.m.Dialog({
          title: sFileName,
          stretch: true, // Fullscreen on all devices
          draggable: true,
          resizable: true,
          contentWidth: "50%",
          contentHeight: "auto",
          horizontalScrolling: false,
          contentPadding: "0rem",
          content: [],
          endButton: new sap.m.Button({
            text: "Close",
            type: "Transparent",
            press: function () {
              if (this._pdfBlobUrl) {
                URL.revokeObjectURL(this._pdfBlobUrl);
                this._pdfBlobUrl = null;
              }
              this._oPreviewDialog.close();
            }.bind(this),
          }),
        });
        this.getView().addDependent(this._oPreviewDialog);
      }
      this._oPreviewDialog.removeAllContent();
      if (sMimeType.startsWith("image/")) {
        const sFileUri = `data:${sMimeType};base64,${sBase64}`;
        const oImage = new sap.m.Image({
          src: sFileUri,
          densityAware: false,
        });
        oImage.addStyleClass("imagePreviewFit");
        this._oPreviewDialog.addContent(oImage);
      } else if (sMimeType === "application/pdf") {
        // Convert base64 to Blob
        const byteCharacters = atob(sBase64);
        const byteArrays = [];
        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
          const slice = byteCharacters.slice(offset, offset + 512);
          const byteNumbers = new Array(slice.length);
          for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          byteArrays.push(byteArray);
        }
        const blob = new Blob(byteArrays, { type: sMimeType });
        const sBlobUrl = URL.createObjectURL(blob);
        this._pdfBlobUrl = sBlobUrl;
        this._oPreviewDialog.addContent(
          new sap.ui.core.HTML({
            content: `<iframe src="${sBlobUrl}" width="100%" height="600px" style="border:none;"></iframe>`,
          })
        );
      } else {
        this._oPreviewDialog.addContent(
          new sap.m.Text({
            text: "Preview not supported.",
          })
        );
      }
      this._oPreviewDialog.open();
    },

    onFileSizeExceeds: function () {
      MessageToast.show(this.i18nModel.getText("uploadDocSize"));
    },

    onPressSetPhoto: function () {
      this.onAfterRendering();
      var oModel = new JSONModel({
        name: "",
      });
      this.getView().setModel(oModel, "IdCardModel");
      this.SS_commonOpenDialog("SetProfile", "sap.kt.com.minihrsolution.fragment.AddIdCard", []);
    },

    IC_onPressClose: function () {
      this.SetProfile.close();
    },

    IC_onPressOpenCamera: function () {
      if (!this.oCameraDialog) {
        sap.ui.core.Fragment.load({
          name: "sap.kt.com.minihrsolution.fragment.Camera",
          controller: this,
        }).then(
          function (oDialog) {
            this.oCameraDialog = oDialog;
            this.getView().addDependent(this.oCameraDialog);
            this.oCameraDialog.attachAfterOpen(this._StartCamera.bind(this));
            this.oCameraDialog.attachAfterClose(this._StopCamera.bind(this));
            this.oCameraDialog.open();
          }.bind(this)
        );
      } else {
        this.oCameraDialog.open();
      }
    },

    _StartCamera: function () {
      var oVideo = document.getElementById("video");
      if (!oVideo) return;

      // Create segmentation instance only once
      if (!this.selfieSegmentation) {
        this.selfieSegmentation = new SelfieSegmentation({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
          },
        });

        this.selfieSegmentation.setOptions({
          modelSelection: 1, // 0 = general, 1 = landscape
        });

        // Store segmentation results
        this.latestSegmentation = null;
        this.selfieSegmentation.onResults((results) => {
          this.latestSegmentation = results;
        });
      }

      // Always create a new Camera instance when starting
      this.camera = new Camera(oVideo, {
        onFrame: async () => {
          await this.selfieSegmentation.send({ image: oVideo });
        },
        width: 640,
        height: 480,
      });
      this.camera.start();
    },

    _StopCamera: function () {
      if (this.camera) {
        this.camera.stop();
        this.camera = null;
      }
      if (this._cameraStream) {
        this._cameraStream.getTracks().forEach((track) => track.stop());
        this._cameraStream = null;
      }
      var oVideo = document.getElementById("video");
      if (oVideo) {
        oVideo.srcObject = null;
      }
    },

    IC_onCapturePress: function () {
      var oCanvas = document.getElementById("canvas");
      var oVideo = document.getElementById("video");

      if (!oCanvas || !oVideo || !this.latestSegmentation) return;

      const oContext = oCanvas.getContext("2d");
      oCanvas.width = oVideo.videoWidth;
      oCanvas.height = oVideo.videoHeight;

      // Fill background with white
      oContext.fillStyle = "white";
      oContext.fillRect(0, 0, oCanvas.width, oCanvas.height);

      // Draw original image
      oContext.drawImage(oVideo, 0, 0, oCanvas.width, oCanvas.height);

      // Apply segmentation mask
      const mask = this.latestSegmentation.segmentationMask;
      oContext.globalCompositeOperation = "destination-in";
      oContext.drawImage(mask, 0, 0, oCanvas.width, oCanvas.height);
      oContext.globalCompositeOperation = "destination-over";
      oContext.fillStyle = "white";
      oContext.fillRect(0, 0, oCanvas.width, oCanvas.height);
      oContext.globalCompositeOperation = "source-over";
      var base64Image = oCanvas.toDataURL("image/png");
      var mimeType = "image/png";
      var imageName = "captured_image.png";
      base64Image = base64Image.replace(`data:${mimeType};base64,`, "");

      var oModel = this.getView().getModel("IdCardModel");
      oModel.setProperty("/Attachment", base64Image);
      oModel.setProperty("/mimeType", mimeType);
      oModel.setProperty("/name", imageName);
      oModel.setProperty("/capturedImage", base64Image);
      oModel.setProperty("/capturedImageName", imageName);

      this._StopCamera();
      this.oCameraDialog.close();
    },

    IC_onPressCloseCameraDialog: function () {
      this._StopCamera();
      if (this.oCameraDialog) {
        this.oCameraDialog.close();
      }
    },

    IC_onHandleUploadPress: function (oEvent) {
      var oFileUploader = oEvent.getSource();
      var oFile = oFileUploader.oFileUpload.files[0];
      if (!oFile) {
        return MessageToast.show("No file selected.");
      }
      var validMimeTypes = ["image/jpeg", "image/png", "image/jpg"];
      var validExtensions = ["jpg", "jpeg", "png"];
      var fileName = oFile.name.toLowerCase();
      var fileExtension = fileName.split(".").pop();
      if (!validMimeTypes.includes(oFile.type) && !validExtensions.includes(fileExtension)) {
        MessageToast.show("Invalid file type.");
        oFileUploader.clear();
        return;
      }
      if (oFile.size > 5 * 1024 * 1024) {
        // 5MB = 5 * 1024 * 1024 bytes
        MessageToast.show("File size exceeds the limit of 5 MB.");
        oFileUploader.clear();
        return;
      }
      var oReader = new FileReader();
      oReader.onload = function (e) {
        var sFileBinary = e.target.result.split(",")[1];
        var oModel = this.getView().getModel("IdCardModel");
        if (oModel) {
          oModel.setProperty("/Attachment", sFileBinary);
          oModel.setProperty("/name", oFile.name);
          oModel.setProperty("/mimeType", oFile.type);
          this.onPressDisplayImageOnCanvas(sFileBinary, oFile.type);
          this.getView().getModel("IdCardModel").setProperty("/name", oFile.name);
        }
        oFileUploader.clear();
      }.bind(this);
      oReader.readAsDataURL(oFile);
    },

    onPressDisplayImageOnCanvas: function (sFileBinary, sFileType) {
      var canvas = document.getElementById("canvas");
      if (canvas) {
        var context = canvas.getContext("2d");
        var img = new Image();
        img.onload = function () {
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = "data:" + sFileType + ";base64," + sFileBinary;
      }
    },

    IC_onPressSave: async function () {
      try {
        var Attchement = this.getView().getModel("IdCardModel");
        var Employee = this.getView().getModel("sEmployeeModel").getData()[0];
        var oPayload = {
          data: {
            ProfilePhoto: Attchement.getProperty("/Attachment"),
            ProfilePhotoType: Attchement.getProperty("/mimeType"),
          },
          filters: { ID: Employee.ID },
        };
        if (!oPayload.data.ProfilePhoto && !oPayload.data.ProfilePhotoType) {
          MessageToast.show(this.i18nModel.getText("selectImage"));
          return;
        }
        this.getBusyDialog();
        // Await the ajax call directly
        var oData = await this.ajaxUpdateWithJQuery("EmployeeDetails", oPayload);
        if (oData.success) {
          await this._fetchCommonData("EmployeeDetails", "sEmployeeModel", {
            EmployeeID: this.EmployeeID,
          });
          this.SetProfile.close();
          MessageToast.show(this.i18nModel.getText("setProfile"));
        } else {
          MessageToast.show(this.i18nModel.getText("commonErrorMessage"));
        }
      } catch (oError) {
        MessageToast.show(oError.responseText);
      } finally {
        this.closeBusyDialog();
      }
    },
    onAfterRendering: function () {
      var canvasElement = document.getElementById("canvas");
      if (canvasElement) {
        var context = canvasElement.getContext("2d");
        if (context) {
          context.clearRect(0, 0, canvasElement.width, canvasElement.height);
        }
      }
    },
    _normalizeDate: function (date) {
      if (!date) return null;
      const newDate = new Date(date); // Create a copy to handle both string and Date objects
      newDate.setHours(0, 0, 0, 0);
      return newDate;
    },
    _validateEducationOverlap: function (newStart, newEnd, existingRecords, editedRecordId) {
      const normalizedNewStart = this._normalizeDate(newStart);
      const normalizedNewEnd = this._normalizeDate(newEnd);
      if (!normalizedNewStart || !normalizedNewEnd) {
        return false;
      }
      for (const record of existingRecords) {
        if (editedRecordId && record.ID === editedRecordId) {
          continue;
        }
        const normalizedExistingStart = this._normalizeDate(record.EducationStartDate);
        const normalizedExistingEnd = this._normalizeDate(record.EducationEndDate);
        if (!normalizedExistingStart || !normalizedExistingEnd) {
          continue;
        }
        if (normalizedNewStart <= normalizedExistingEnd && normalizedNewEnd >= normalizedExistingStart) {
          return true;
        }
      }
      return false;
    },
    _getLatestEducationEndDate: function () {
      const aEducationData = this.getOwnerComponent().getModel("sEducationModel")?.getData();
      if (!aEducationData || aEducationData.length === 0) {
        return null;
      }
      const latestDate = aEducationData.reduce((maxDate, record) => {
        const currentEndDate = new Date(record.EducationEndDate);
        return currentEndDate > maxDate ? currentEndDate : maxDate;
      }, new Date(0));
      return latestDate.getTime() === new Date(0).getTime() ? null : latestDate;
    },

    saveEducationDetails: async function (bIsCreate) {
      try {
        // ---  field validation ---
        const isValid = utils._LCvalidateMandatoryField(sap.ui.getCore().byId("AddEd_id_College"), "ID") && utils._LCstrictValidationComboBox(sap.ui.getCore().byId("AddEd_id_Degree"), "ID") && utils._LCvalidateDate(sap.ui.getCore().byId("AddEd_id_StartEdu"), "ID") && utils._LCvalidateDate(sap.ui.getCore().byId("AddEd_id_EndEdu"), "ID") && utils._LCvalidateGrade(sap.ui.getCore().byId("AddEd_id_Grade"), "ID", "AddEd_id_GradeType") && utils._LCstrictValidationComboBox(sap.ui.getCore().byId("AddEd_id_GradeType"), "ID");
        if (!isValid) {
          MessageToast.show(this.i18nModel.getText("mandetoryFields"));
          return;
        }
        let oModelData = this.getView().getModel("educationModel").getData();
        const sNewDegree = (sap.ui.getCore().byId("AddEd_id_Degree").getSelectedKey() || "").trim().toLowerCase();
        const aExistingEducation = this.getOwnerComponent().getModel("sEducationModel").getData() || [];
        const isDuplicate = aExistingEducation.some((edu) => {
          const isSameDegree = edu.DegreeName.trim().toLowerCase() === sNewDegree;
          return isSameDegree && (bIsCreate || edu.ID !== oModelData.ID);
        });

        if (isDuplicate) {
          MessageBox.error(this.i18nModel.getText("duplicateDegreeError", [sap.ui.getCore().byId("AddEd_id_Degree").getSelectedItem().getText()]));
          return;
        }
        // --- Check for overlapping dates ---
        const oStartDatePicker = sap.ui.getCore().byId("AddEd_id_StartEdu");
        const oEndDatePicker = sap.ui.getCore().byId("AddEd_id_EndEdu");
        const newStartDate = oStartDatePicker.getDateValue();
        const newEndDate = oEndDatePicker.getDateValue();
        const editedRecordId = bIsCreate ? null : oModelData.ID;
        if (this._validateEducationOverlap(newStartDate, newEndDate, aExistingEducation, editedRecordId)) {
          MessageBox.error(this.i18nModel.getText("educationOverlapError"));
          return;
        }
        this.getBusyDialog();
        // Prepare model data for payload
        oModelData.EmployeeID = this.EmployeeID;
        oModelData.DegreeName = sap.ui.getCore().byId("AddEd_id_Degree").getSelectedKey() || "";
        oModelData.GradeType = sap.ui.getCore().byId("AddEd_id_GradeType").getSelectedKey() || "";

        let startDate = sap.ui.getCore().byId("AddEd_id_StartEdu").getValue();
        let endDate = sap.ui.getCore().byId("AddEd_id_EndEdu").getValue();
        oModelData.EducationStartDate = startDate ? startDate.split("/").reverse().join("-") : "";
        oModelData.EducationEndDate = endDate ? endDate.split("/").reverse().join("-") : "";

        let oPayload, sSuccessMessage, oResponse;
        if (bIsCreate) {
          oPayload = { data: oModelData };
          sSuccessMessage = this.i18nModel.getText("eduDataSaved");
          oResponse = await this.ajaxCreateWithJQuery("EducationalDetails", oPayload);
        } else {
          oPayload = {
            data: oModelData,
            filters: { ID: oModelData.ID },
          };
          sSuccessMessage = this.i18nModel.getText("eduDataupdate");
          oResponse = await this.ajaxUpdateWithJQuery("EducationalDetails", oPayload);
        }
        if (oResponse.success) {
          MessageToast.show(sSuccessMessage);
          this.SEd_oDialog.close();
          this.byId("EdF_id_EduTable").removeSelections(true);
          this.SS_commonEduFunction();
          await this._fetchCommonData("EducationalDetails", "sEducationModel", {
            EmployeeID: this.EmployeeID,
          });
        } else {
          MessageToast.show(this.i18nModel.getText("commonErrorMessage"));
        }
      } catch (error) {
        const errorMessage = error?.responseText || error.message || "Unexpected error";
        MessageToast.show(errorMessage);
      } finally {
        this.closeBusyDialog();
      }
    },
    AddEd_onSubmitEdDetails: function () {
      this.saveEducationDetails(true); // create mode
    },
    AddEd_onUpdateEdDetails: function () {
      this.saveEducationDetails(false); // update mode
    },

    //Employment detail create calls
    saveEmploymentDetails: function (bIsCreate) {
      try {
        // --- Mandatory Fields Validation ---
        const isValid = utils._LCvalidateMandatoryField(sap.ui.getCore().byId("AddEmp_id_Company"), "ID") && utils._LCvalidateMandatoryField(sap.ui.getCore().byId("AddEmp_id_Desig"), "ID") && utils._LCvalidateMandatoryField(sap.ui.getCore().byId("AddEmp_id_OfcAddress"), "ID") && utils._LCvalidateDate(sap.ui.getCore().byId("AddEmp_id_StartDate"), "ID") && utils._LCvalidateDate(sap.ui.getCore().byId("AddEmp_id_EndDate"), "ID");
        if (!isValid) {
          MessageToast.show(this.i18nModel.getText("mandetoryFields"));
          return;
        }
        // ---Business Logic Validation: Employment Start Date vs. Education End Date ---
        if (bIsCreate) {
          const latestEducationEndDate = this._getLatestEducationEndDate();
          const employmentStartDate = sap.ui.getCore().byId("AddEmp_id_StartDate").getDateValue();

          if (latestEducationEndDate && employmentStartDate) {
            const normalizedLatestEduEnd = this._normalizeDate(latestEducationEndDate);
            const normalizedEmploymentStart = this._normalizeDate(employmentStartDate);
            if (normalizedEmploymentStart <= normalizedLatestEduEnd) {
              MessageBox.error(this.i18nModel.getText("employmentStartDateError"));
              return; // Stop
            }
          }
        }

        // --- NEW: Check for overlapping employment dates ---
        const oStartDatePicker = sap.ui.getCore().byId("AddEmp_id_StartDate");
        const oEndDatePicker = sap.ui.getCore().byId("AddEmp_id_EndDate");
        const newStartDate = oStartDatePicker.getDateValue();
        const newEndDate = oEndDatePicker.getDateValue();
        const aExistingEmployment = this.getOwnerComponent().getModel("sEmploymentModel").getData() || [];
        const oModelData = this.getView().getModel("employmentModel").getData();
        const editedRecordId = bIsCreate ? null : oModelData.ID;

        if (this._validateEmploymentOverlap(newStartDate, newEndDate, aExistingEmployment, editedRecordId)) {
          MessageBox.error(this.i18nModel.getText("employmentOverlapError"));
          return;
        }

        // Optional Fields Validation
        const name = sap.ui.getCore().byId("AdEmp_id_RCNameI").getValue().trim();
        const mail = sap.ui.getCore().byId("AdEmp_id_RCMailI").getValue().trim();
        const RCISTDCode = sap.ui.getCore().byId("AdEmp_id_RCSTDCode").getSelectedKey() || "";
        const mobileNo = sap.ui.getCore().byId("AdEmp_id_RCMobileI").getValue().trim();
        const nameTwo = sap.ui.getCore().byId("AdEmp_id_RCNameII").getValue().trim();
        const RCIISTDCode = sap.ui.getCore().byId("AdEmp_id_RCSTD").getSelectedKey() || "";
        const mailTwo = sap.ui.getCore().byId("AdEmp_id_RCMailII").getValue().trim();
        const mobileNoTwo = sap.ui.getCore().byId("AdEmp_id_RCMobileII").getValue().trim();
        const optionalValid = (name === "" || utils._LCvalidateName(sap.ui.getCore().byId("AdEmp_id_RCNameI"), "ID")) && (mail === "" || utils._LCvalidateEmail(sap.ui.getCore().byId("AdEmp_id_RCMailI"), "ID")) && (RCISTDCode === "" || utils._LCvalidateMobileNumberWithSTD(sap.ui.getCore().byId("AdEmp_id_RCMobileI"), RCISTDCode)) && (mobileNo === "" || utils._LCvalidateMobileNumber(sap.ui.getCore().byId("AdEmp_id_RCMobileI"), "ID")) && (nameTwo === "" || utils._LCvalidateName(sap.ui.getCore().byId("AdEmp_id_RCNameII"), "ID")) && (mailTwo === "" || utils._LCvalidateEmail(sap.ui.getCore().byId("AdEmp_id_RCMailII"), "ID")) && (RCIISTDCode === "" || utils._LCvalidateMandatoryField(sap.ui.getCore().byId("AdEmp_id_RCSTD"), "ID")) && (mobileNoTwo === "" || utils._LCvalidateMobileNumberWithSTD(sap.ui.getCore().byId("AdEmp_id_RCMobileII"), RCIISTDCode));

        
        if (!optionalValid) {
          MessageToast.show(this.i18nModel.getText("mandetoryFields"));
          return;
        }
        // Prepare data model for submission
        this.getBusyDialog();
        let oModel = this.getView().getModel("employmentModel").getData();
        oModel.EmployeeID = this.EmployeeID;
        oModel.Designation = sap.ui.getCore().byId("AddEmp_id_Desig").getValue();
        oModel.RCISal = sap.ui.getCore().byId("AddEmp_id_SalI").getSelectedKey() || "";
        oModel.RCIISal = sap.ui.getCore().byId("AdEmp_id_RCSalII").getSelectedKey() || "";
        oModel.StartDate = sap.ui.getCore().byId("AddEmp_id_StartDate").getValue().split("/").reverse().join("-");
        oModel.EndDate = sap.ui.getCore().byId("AddEmp_id_EndDate").getValue().split("/").reverse().join("-");

        let oPayload;
        let fnCall;
        let sSuccessMessage;
        // Clear validation states for optional fields before closing
        const aOptionalIds = ["AdEmp_id_RCNameI", "AdEmp_id_RCMailI", "AdEmp_id_RCMobileI", "AdEmp_id_RCNameII", "AdEmp_id_RCMailII", "AdEmp_id_RCMobileII"];
        aOptionalIds.forEach((id) => sap.ui.getCore().byId(id).setValueState("None"));
        if (bIsCreate) {
          oPayload = {
            data: oModel,
          };
          fnCall = this.ajaxCreateWithJQuery("EmploymentDetails", oPayload);
          sSuccessMessage = this.i18nModel.getText("empDataSaved");
        } else {
          oPayload = {
            data: oModel,
            filters: {
              ID: oModel.ID,
            },
          };
          fnCall = this.ajaxUpdateWithJQuery("EmploymentDetails", oPayload);
          sSuccessMessage = this.i18nModel.getText("empDataupdate");
        }
        fnCall
          .then((oData) => {
            if (oData.success) {
              MessageToast.show(sSuccessMessage);
              this.SEmp_oDialog.close();
              this.byId("EmpF_id_EmpTable").removeSelections(true);
              this.SS_commonEmpFunction();
              this._fetchCommonData("EmploymentDetails", "sEmploymentModel", {
                EmployeeID: this.EmployeeID,
              });
            } else {
              MessageToast.show(this.i18nModel.getText("commonErrorMessage"));
            }
            this.closeBusyDialog();
          })
          .catch((error) => {
            this.closeBusyDialog();
            MessageToast.show(error.responseText || "An error occurred during the save operation.");
          });
      } catch (error) {
        this.closeBusyDialog();
        MessageToast.show(error.responseText || "An unexpected error occurred.");
      }
    },

    AddEmp_onSubmitEmpDetails: function () {
      this.saveEmploymentDetails(true); // create mode
    },

    AddEmp_onUpdateEmpDetails: function () {
      this.saveEmploymentDetails(false); // update mode
    },
    _validateEmploymentOverlap: function (newStart, newEnd, existingRecords, editedRecordId) {
      const normalizedNewStart = this._normalizeDate(newStart);
      const normalizedNewEnd = this._normalizeDate(newEnd);

      if (!normalizedNewStart || !normalizedNewEnd) {
        return false;
      }

      for (const record of existingRecords) {
        if (editedRecordId && record.ID === editedRecordId) {
          continue;
        }
        const normalizedExistingStart = this._normalizeDate(record.StartDate);
        const normalizedExistingEnd = this._normalizeDate(record.EndDate);
        if (!normalizedExistingStart || !normalizedExistingEnd) {
          continue;
        }
        if (normalizedNewStart <= normalizedExistingEnd && normalizedNewEnd >= normalizedExistingStart) {
          return true;
        }
      }
      return false;
    },
    //Reference details
    EmpF_onReferenceDetails: function () {
      var that = this;
      var oTable = this.byId("EmpF_id_EmpTable");
      var aSelectedContexts = oTable.getSelectedContexts();
      if (aSelectedContexts.length === 0) {
        sap.m.MessageToast.show(that.i18nModel.getText("selectRowToEdit")); // Using i18n for message text
        return;
      }
      var dataModel = aSelectedContexts[0].getObject();
      // Check if at least one reference set is available
      var referenceDetailsExist = (dataModel.RCISal && dataModel.RCIName && dataModel.RCIAddress && dataModel.RCIEmailID && dataModel.RCIMobileNo) || (dataModel.RCIISal && dataModel.RCIIName && dataModel.RCIIAddress && dataModel.RCIIEmailID && dataModel.RCIIMobileNo);
      if (!referenceDetailsExist) {
        sap.m.MessageToast.show(that.i18nModel.getText("noReferenceDetails")); // Using i18n for warning message
        return;
      }
      var formattedReferenceData = `<div style="padding-left: 15px; padding-right: 15px;">`;
      // Add first reference if available
      if (dataModel.RCISal && dataModel.RCIName && dataModel.RCIAddress && dataModel.RCIEmailID && dataModel.RCIMobileNo) {
        formattedReferenceData += `
                    <p><b>${that.i18nModel.getText("name")}:</b> ${dataModel.RCISal} ${dataModel.RCIName}</p>
                    <p><b>${that.i18nModel.getText("address")}:</b> ${dataModel.RCIAddress}</p>
                    <p><b>${that.i18nModel.getText("emailId")}:</b> ${dataModel.RCIEmailID}</p>
                    <p><b>${that.i18nModel.getText("mobileNo")}:</b> ${dataModel.RCISTDCode || ""} ${dataModel.RCIMobileNo || ""}</p>
                    <br/>`;
      }
      // Add second reference if available
      if (dataModel.RCIISal && dataModel.RCIIName && dataModel.RCIIAddress && dataModel.RCIIEmailID && dataModel.RCIIMobileNo) {
        formattedReferenceData += `
                    <p><b>${that.i18nModel.getText("name")}:</b> ${dataModel.RCIISal} ${dataModel.RCIIName}</p>
                    <p><b>${that.i18nModel.getText("address")}:</b> ${dataModel.RCIIAddress}</p>
                    <p><b>${that.i18nModel.getText("emailId")}:</b> ${dataModel.RCIIEmailID}</p>
                    <p><b>${that.i18nModel.getText("mobileNo")}:</b> ${dataModel.RCIISTDCode || ""} ${dataModel.RCIIMobileNo || ""}</p>`;
      }
      formattedReferenceData += `</div>`;

      // Create a dialog to display the reference details
      var oDialog = new sap.m.Dialog({
        title: that.i18nModel.getText("referenceDetails"),
        draggable: false,
        resizable: false,
        contentWidth: "500px",
        contentHeight: "400px",
        verticalScrolling: true,
        content: new sap.ui.core.HTML({
          content: formattedReferenceData,
        }),
        beginButton: new sap.m.Button({
          text: that.i18nModel.getText("close"),
          type: "Transparent",
          press: function () {
            oDialog.close();
            oTable.removeSelections(true);
          },
        }),
      });
      oDialog.open();
    },

    // Function to display salary panels and handle Appraisal button logic

    SS_readSalaryDetails: async function (filter) {
      try {
        this.getBusyDialog();
        const oData = await this.ajaxReadWithJQuery("SalaryDetails", {
          EmployeeID: this.EmployeeID,
        });
        const offerData = Array.isArray(oData.data) ? oData.data : [oData.data];
        this.getOwnerComponent().setModel(new JSONModel(offerData), "salaryData");
        this.displaySalaryPanels(offerData);
        this.closeBusyDialog();
      } catch (error) {
        MessageToast.show(error.message || error.responseText);
        this.closeBusyDialog();
      }
    },

    // Function to display salary data in UI panels
    displaySalaryPanels: function (salaryDetailsArray) {
      var nextMonthDate = this.getView().getModel("controller").getProperty("/nextMonthMinDate");
      var EmployeeStatus = this.getView().getModel("sEmployeeModel").getProperty("/0/EmployeeStatus");
      var AppraisalModel = new JSONModel({
        CtcPercentage: "",
        VariablePay: "0",
        TotalCTC: "0",
        TotalVariablePay: "0",
        EffectiveDate: nextMonthDate,
      });
      this.getView().setModel(AppraisalModel, "AppraisalModel");
      var oVBox = this.byId("salaryVBox");
      oVBox.removeAllItems();
      var oToday = new Date();
      salaryDetailsArray.forEach((offerData, index) => {
        var oEffectiveDate = new Date(offerData.EffectiveDate);
        var isLastRecord = index === salaryDetailsArray.length - 1;
        var sTitleText = isLastRecord ? `${this.i18nModel.getText("salaryEffectiveDate")}: ${this.Formatter.formatDate(offerData.EffectiveDate || "")}, ${this.i18nModel.getText("costOfCompany")}: ${this.i18nModel.getText("salaryINR")} ${this.Formatter.fromatNumber(offerData.CostofCompany)}` : `${this.i18nModel.getText("salaryAppraisalDate")}: ${this.Formatter.formatDate(offerData.AppraisalDate)}, ${this.i18nModel.getText("salaryEffectiveDate")}: ${this.Formatter.formatDate(offerData.EffectiveDate || "")}, ${this.i18nModel.getText("costOfCompany")}: ${this.i18nModel.getText("salaryINR")} ${this.Formatter.fromatNumber(offerData.CostofCompany)}`;
        var oTitleText = new sap.m.Text({
          text: sTitleText,
          wrapping: true,
        }).addStyleClass("sapUiTinyMarginBottom");

        var aButtonContent = [];
        // Delete button
        if (salaryDetailsArray.length > 1 && oEffectiveDate > oToday && this.sPath !== "SelfService" && EmployeeStatus === "Active") {
          var oDeleteButton = new sap.m.Button({
            text: this.i18nModel.getText("delete"),
            type: "Transparent",
            press: function () {
              this.onDeleteSalary(offerData);
            }.bind(this),
          }).addStyleClass("sapUiTinyMarginBegin");
          aButtonContent.push(oDeleteButton);
        }

        // Sync Salary button (NEW)
        if (this.sPath !== "SelfService" && index === 0 && EmployeeStatus === "Active") {
          var oSyncSalaryButton = new sap.m.Button({
            text: this.i18nModel.getText("syncSalary") || "Sync Salary",
            type: "Transparent",
            press: function () {
              this.onSyncSalary(offerData);
            }.bind(this)
          }).addStyleClass("sapUiTinyMarginBegin");

          aButtonContent.push(oSyncSalaryButton);
        }

        // Appraisal button
        if (index === 0 && oEffectiveDate < oToday && this.sPath !== "SelfService" && EmployeeStatus === "Active") {
          var oAppraisalButton = new sap.m.Button({
            text: this.i18nModel.getText("appraisal"),
            type: "Transparent",
            //visible: this.ViewModel.getProperty("/RelievingLetter"),
            press: function () {
              this._fetchCommonData("TaxCalculation", "TDSModel", { Country: this.getView().getModel("sEmployeeModel").getData()[0].CountryCode });
              this.SS_commonOpenDialog("Appraisal", "sap.kt.com.minihrsolution.fragment.Appraisal", ["SS_id_Joinn"]);
              setTimeout(() => {
                this.onAppraisalDialogReady(offerData);
              }, 300);
            }.bind(this),
          }).addStyleClass("sapUiTinyMarginBegin");
          aButtonContent.push(oAppraisalButton);
        }
        var oButtonBox = new sap.m.HBox({
          items: aButtonContent,
          alignItems: "Center",
          justifyContent: "End",
          wrap: "Wrap",
        });
        var oHeaderBox = new sap.m.HBox({
          items: [oTitleText, oButtonBox],
          justifyContent: "SpaceBetween",
          alignItems: "Center",
          width: "100%",
        });
        var oPanel = new sap.m.Panel({
          expandable: true,
          expanded: true,
          headerToolbar: new sap.m.Toolbar({ content: [oHeaderBox] }),
        });
        oPanel.addStyleClass("sapUiSmallMarginBottom");
        var oFragModel = new sap.ui.model.json.JSONModel(offerData);
        oPanel.setModel(oFragModel, "salaryData");
        var oFragment = sap.ui.xmlfragment(this.getView().getId(), "sap.kt.com.minihrsolution.fragment.SalaryDisplay", this);
        oPanel.addContent(oFragment);
        oVBox.addItem(oPanel);
      });
    },

    // Function to initialize dialog values
    onAppraisalDialogReady: function (latestSalaryData) {
      const AppraisalModel = this.getView().getModel("AppraisalModel");
      const lastCTC = parseFloat(latestSalaryData.CTC?.toString().replaceAll(",", "")) || 0;
      const lastVariablePay = parseFloat(latestSalaryData.VariablePay) || 0;

      AppraisalModel.setProperty("/PreviousGrossPay", this.Formatter.fromatNumber(lastCTC));
      AppraisalModel.setProperty("/PreviousVariablePay", this.Formatter.fromatNumber(lastVariablePay));
      const EmployeePF = parseFloat(latestSalaryData.EmployeePF) || 0;
      const EmployerPF = parseFloat(latestSalaryData.EmployerPF) || 0;
      const oRadioGroup = sap.ui.getCore().byId("AF_id_RadioButTds");
      const oTDSRadio = sap.ui.getCore().byId("AF_id_TDSRadio");
      const oPFRadio = oRadioGroup.getButtons()[1];

      if (!oRadioGroup || !oTDSRadio || !oPFRadio) return;

      // Check if both PF values exist
      if (EmployeePF > 0 && EmployerPF > 0) {
        oRadioGroup.setVisible(false); // Hide entire radio button group
        oRadioGroup.setSelectedIndex(1);
      } else {
        oRadioGroup.setVisible(true); // Show the radio button group when PF is not applicable
        oRadioGroup.setSelectedIndex(0);
      }
    },

    onPressAppraisalClose: function () {
      sap.ui.getCore().byId("AF_id_CTC").setValue("");
      sap.ui.getCore().byId("AF_idTextCTC").setText("");
      sap.ui.getCore().byId("AE_idTextVP").setText("");
      sap.ui.getCore().byId("AF_id_CTC").setValueState("None");
      sap.ui.getCore().byId("AF_id_VariablePay").setValueState("None");
      this.Appraisal.close();
    },

    onDeleteSalary: function (value) {
      this.showConfirmationDialog(
        this.i18nModel.getText("msgBoxConfirm"),
        this.i18nModel.getText("appraisalDeleteMess"),
        async function () {
          this.getBusyDialog(); // Show busy dialog
          try {
            await this.ajaxDeleteWithJQuery("/SalaryDetails", {
              filters: { UUID: value.UUID, EmployeeID: value.EmployeeID },
            });
            MessageToast.show(this.i18nModel.getText("appraisalDeleteMessageSucc"));
            this.SS_readSalaryDetails();
          } catch (error) {
            MessageToast.show(this.i18nModel.getText("DocumentDeleteError") || "Error deleting document.");
          } finally {
            this.closeBusyDialog(); // Ensure the busy dialog is always closed
          }
        }.bind(this) // Important: bind 'this' to maintain context
      );
    },

    EOD_validateAmount: function (oEvent) {
      var CTCType = sap.ui.getCore().byId("ED_Frg_idAppraisalType")._getSelectedItemText();
      if (CTCType === "Percentage") {
        utils._LCvalidateTraineeAmount(oEvent);
      } else {
        utils._LCvalidateCTC(oEvent);
      }
      this.CommonCalculation();
    },

    EOD_validatevariable: function (oEvent) {
      utils._LCvalidateVariablePay(oEvent);
      this.CommonCalculation();
    },

    CommonCalculation: async function () {
      var AppraisalModel = this.getView().getModel("AppraisalModel");
      var salaryData = this.getView().getModel("salaryData").getData();

      var oSelect = sap.ui.getCore().byId("ED_Frg_idAppraisalType");
      var CTCType = oSelect.getSelectedItem().getText(); // 'CTC' or 'Percentage'

      this.latest = salaryData.reduce(function (latestEntry, currentEntry) {
        return new Date(currentEntry.EffectiveDate) > new Date(latestEntry.EffectiveDate) ? currentEntry : latestEntry;
      });

      var ctcPercentage = parseFloat(AppraisalModel.getProperty("/CtcPercentage")) || 0;

      // Safely remove commas and parse CTC
      var baseCTC = parseFloat((this.latest.CTC || "0").toString().replace(/,/g, "")) || 0;

      // Calculate the increment amount
      var CtcCalculate = (baseCTC * ctcPercentage) / 100;

      // Calculate the new CTC based on the CTCType
      var NewCTC = CTCType === "Percentage" ? baseCTC + CtcCalculate : baseCTC + ctcPercentage;

      this.getView().getModel("employeeModel").setProperty("/CTC", this.Formatter.fromatNumber(NewCTC));
      this.getView().getModel("employeeModel").setProperty("/JoiningBonus", this.Formatter.fromatNumber(0));
      var type = sap.ui.getCore().byId("AF_id_RadioButTds").getSelectedButton().getText();
      var variablePay = AppraisalModel.getProperty("/VariablePay");
      this.getView().getModel("employeeModel").setProperty("/VariablePercentage", variablePay);
      this._calculateSalaryComponents(type);
      AppraisalModel.setProperty("/TotalCTC", this.Formatter.fromatNumber(NewCTC));
      AppraisalModel.setProperty("/TotalVariablePay", this.Formatter.fromatNumber(this.getView().getModel("employeeModel").getData().VariablePay));
    },

    createAppraisalPayload: function (sEffectiveDate) {
      var employeeData = this.getView().getModel("employeeModel").getData();
      var appraisalData = this.getView().getModel("AppraisalModel").getData();

      let effectiveDateFinal;
      //  Sync Salary → use passed date
      if (sEffectiveDate) {
        effectiveDateFinal = sEffectiveDate;
      } else {
        // Appraisal → use AppraisalModel date
        const year = appraisalData.EffectiveDate.getFullYear();
        const month = String(appraisalData.EffectiveDate.getMonth() + 1).padStart(2, "0");
        effectiveDateFinal = `${year}-${month}-01`;
      }

      return {
        data: {
          EmployeeID: this.EmployeeID,
          JoiningDate: this.latest.JoiningDate || "",
          // CTC: employeeData.CTC,
          CTC: parseFloat(employeeData.CTC.toString().replace(/,/g, "")),
          EmploymentBond: employeeData.EmploymentBond || false,
          JoiningBonus: employeeData.JoiningBonus,
          BaseLocation: this.latest.BaseLocation,
          BasicSalary: employeeData.BasicSalary,
          HRA: employeeData.HRA,
          IncomeTax: employeeData.IncomeTax,
          MedicalInsurance: employeeData.MedicalInsurance,
          Gratuity: employeeData.Gratuity,
          VariablePay: employeeData.VariablePay,
          CostofCompany: employeeData.CostofCompany,
          Total: employeeData.Total,
          HikePercentage: appraisalData.CtcPercentage,
          AppraisalDate: new Date().toISOString().split("T")[0] || "",
          EffectiveDate: effectiveDateFinal,
          EmployeePF: employeeData.EmployeePF,
          EmployerPF: employeeData.EmployerPF,
          TotalDeduction: employeeData.TotalDeduction,
          SpecailAllowance: employeeData.SpecailAllowance,
          PT: employeeData.PT,
          GrossPay: employeeData.GrossPay,
          VariablePercentage: employeeData.VariablePercentage,
          GrossPayMontly: employeeData.GrossPayMontly,
        },
      };
    },

    syncSalaryCalculation: async function () {
      var oView = this.getView();
      var salaryData = oView.getModel("salaryData")?.getData();
      if (!salaryData || salaryData.length === 0) {
        return MessageToast.show("No salary data found");
      }

      // Get latest salary record
      this.latest = salaryData.reduce(function (latestEntry, currentEntry) {
        return new Date(currentEntry.EffectiveDate) > new Date(latestEntry.EffectiveDate) ? currentEntry : latestEntry;
      });

      // Base CTC
      var baseCTC = parseFloat((this.latest.CTC || "0").toString().replace(/,/g, "")) || 0;

      // Variable Percentage
      var variablePercentage = parseFloat(this.latest.VariablePercentage) || 0;

      // Set only required fields
      oView.getModel("employeeModel").setProperty("/CTC", this.Formatter.fromatNumber(baseCTC));
      oView.getModel("employeeModel").setProperty("/VariablePercentage", variablePercentage);
      oView.getModel("employeeModel").setProperty("/JoiningBonus", this.Formatter.fromatNumber(0));
      // IncomeTax check for TDS
      var incomeTax = parseFloat(this.latest.IncomeTax) || 0;
      var type = incomeTax === 0 ? "" : "TDS";

      await this._fetchCommonData("TaxCalculation", "TDSModel", { Country: this.getView().getModel("sEmployeeModel").getData()[0].CountryCode });

      // Call salary component calculation
      this._calculateSalaryComponents(type);
    },

    onSyncSalary: async function () {
    try {
      this.getBusyDialog();

      // Step 1
      await this.syncSalaryCalculation();

      // Step 2 → Get Effective Date
      let sEffectiveDate = await this._getNextEffectiveDateFromPaySlip();

      var salaryData = this.getView().getModel("salaryData").getData();

      // Step 3 → fallback from salary table
      if (!sEffectiveDate && salaryData && salaryData.length > 0) {
        const latestSalary = salaryData.reduce(function (latest, current) {
          return new Date(current.EffectiveDate) > new Date(latest.EffectiveDate)
            ? current
            : latest;
        });

        sEffectiveDate = latestSalary.EffectiveDate;
      }

      // Step 4 → final fallback
      if (!sEffectiveDate) {
        sEffectiveDate = new Date().toISOString().split("T")[0];
      }

      // Step 5 → Create payload
      var oPayload = this.createAppraisalPayload(sEffectiveDate);

      var lastRecord = salaryData[salaryData.length - 1];
      oPayload.data.EmploymentBond = lastRecord?.EmploymentBond;

      // Step 6 → Save
      await this.ajaxCreateWithJQuery("SalaryDetails", oPayload);

      // Step 7 → Refresh
      await this.SS_readSalaryDetails();

      MessageToast.show("Salary synced successfully.");

    } catch (err) {
      console.error(err);
      MessageToast.show("Error while syncing salary.");
    } finally {
      this.closeBusyDialog();
    }
  },

    _getNextEffectiveDateFromPaySlip: async function () {
      try {
        let response = await this.ajaxReadWithJQuery("AdminPaySlip", {
          EmployeeID: this.EmployeeID
        });

        let aData = response?.data || [];

        if (!aData.length) {
          return null;
        }

        // Get latest YearMonth
        const latest = aData.reduce((prev, curr) => {
          return new Date(curr.YearMonth) > new Date(prev.YearMonth)
            ? curr
            : prev;
        });

        const baseDateStr = latest.YearMonth;

        if (!baseDateStr) {
          return null;
        }

        const dateObj = new Date(baseDateStr);

        if (isNaN(dateObj)) {
          console.error("Invalid YearMonth format:", baseDateStr);
          return null;
        }

        // Add 1 month
        dateObj.setMonth(dateObj.getMonth() + 1);
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, "0");

        return `${year}-${month}-01`;
      } catch (error) {
        console.error("Error fetching payslip:", error);
        return null;
      }
    },

    onSelectChange: function (oEvent) {
      oEvent.getSource().getSelectedItem().getText() === "Percentage" ? utils._LCvalidateTraineeAmount(sap.ui.getCore().byId("AF_id_CTC"), "ID") : utils._LCvalidateAmount(sap.ui.getCore().byId("AF_id_CTC"), "ID");
    },

    onPressAppraisalSave: async function () {
      await this.CommonCalculation();
      var oSelect = sap.ui.getCore().byId("ED_Frg_idAppraisalType");
      var CTCType = oSelect.getSelectedItem().getText();

      var isCTCValid = CTCType === "Percentage" ? utils._LCvalidateTraineeAmount(sap.ui.getCore().byId("AF_id_CTC"), "ID") : utils._LCvalidateAmount(sap.ui.getCore().byId("AF_id_CTC"), "ID");

      var isVariablePayValid = utils._LCvalidateVariablePay(sap.ui.getCore().byId("AF_id_VariablePay"), "ID");
      if (isCTCValid && isVariablePayValid) {
        this.getBusyDialog();
        try {
          var oPayload = this.createAppraisalPayload();
          await this.ajaxCreateWithJQuery("SalaryDetails", oPayload);
          await this.SS_readSalaryDetails();

          MessageToast.show(this.i18nModel.getText("appraisalSaved"));
          sap.ui.getCore().byId("EOUF_id_CTCPercentage").setValueState("None");
          this.Appraisal.close();
        } catch (err) {
          this.Appraisal.close();
        } finally {
          this.closeBusyDialog();
        }
      } else {
        MessageToast.show(this.i18nModel.getText("mandetoryFields"));
      }
    },

    //  download Visiting Card
    onDownloadVisitCard: function () {
      var oEmployeeData = this.getView().getModel("sEmployeeModel").getData();
      if (oEmployeeData) {
        this.CommonVisitingCard(oEmployeeData[0].EmployeeName, oEmployeeData[0].MobileNo, oEmployeeData[0].CompanyEmailID, oEmployeeData[0].Designation, oEmployeeData[0].CompanyCode);
      }
    },
    SS_onDownloadExperienceLetter: function () {
      this.getView().getModel("PDFData").setProperty("/OnlyRTEFlag", true);
      var oEmpModel = this.getView().getModel("sEmployeeModel").getData()[0];
      var today = new Date();
      var date = Formatter.formatDate(today);
      var twoMonthsLater = new Date(today.setMonth(today.getMonth() + 2));
      var relievingDate = Formatter.formatDate(twoMonthsLater);
      var joiningDate = Formatter.formatDate(oEmpModel.JoiningDate);
      var empName = oEmpModel.Salutation + " " + oEmpModel.EmployeeName;
      var empID = oEmpModel.EmployeeID;
      var empDesig = oEmpModel.Designation;
      this.getView().getModel("PDFData").setProperty("/CreateDate", date);
      this.getView().getModel("PDFData").setProperty("/CertificateTitle", "RELIEVING AND EXPERIENCE LETTER");
      var data = `
            <div style="text-align: justify;">
                <p> This is to certify that <b>${empName}</b> with Employee ID <b>${empID}</b> has worked with our company <b>${this.companyName}</b> as a <b>${empDesig}</b> from <b>${joiningDate}</b> to <b>${date}</b>. During his tenure with us his contributions to the organization are highly appreciated. He possesses good moral values and the right attitude</p> 
                <p>With reference to your resignation, you stand relieved from the services of ${this.companyName} with effect from the close of working hours <b>${relievingDate}</b>. We would like you to continue to be bound by the conditions of confidentiality and other relevant terms of the employment agreement you signed with ${this.companyName}</p>
                <p>Wishing you all the best in your future endeavors.</p>
            </div>`;
      this.getView().getModel("PDFData").setProperty("/RTEText", data);
      this.SS_commonOpenDialog("SSRTE_oDialog", "sap.kt.com.minihrsolution.fragment.CommonRTE");
    },

    SS_onDownloadTerminateLetter: function () {
      this.getView().getModel("PDFData").setProperty("/OnlyRTEFlag", true);
      var oEmpModel = this.getView().getModel("sEmployeeModel").getData()[0];
      var date = Formatter.formatDate(new Date());
      var empName = oEmpModel.Salutation + " " + oEmpModel.EmployeeName;
      var empDesig = oEmpModel.Designation;
      this.getView().getModel("PDFData").setProperty("/CreateDate", date);
      this.getView().getModel("PDFData").setProperty("/CertificateTitle", "TERMINATION LETTER");
      var data = `
                <div style="text-align: justify;">
                    <p>This is to formally notify that <b>${empName}</b>, has been terminated from the services of <b>${this.companyName}</b> with effect from <b>${date}</b> due to reasons communicated during prior discussions. During their tenure as <b>${empDesig}</b>, we have reviewed the performance and discussed areas of concern in detail.</p> 
                    <p>Despite efforts to resolve these concerns, we find it necessary to discontinue the employment relationship effective immediately. Please ensure that all company assets and materials in your possession are returned by the specified date. You are reminded of your obligation to maintain confidentiality and abide by other terms of the employment agreement.</p>
                    <p>Kindly acknowledge the copy of the document for office records. We look forward to a fruitful association.</p>
                    <p>We wish you the best of luck in your future endeavors</p>
                </div>`;

      this.getView().getModel("PDFData").setProperty("/RTEText", data);
      this.SS_commonOpenDialog("SSRTE_oDialog", "sap.kt.com.minihrsolution.fragment.CommonRTE");
    },

    SS_onDownloadWorkLetter: function () {
      this.getView().getModel("PDFData").setProperty("/OnlyRTEFlag", true);
      var oEmpModel = this.getView().getModel("sEmployeeModel").getData()[0];
      var today = new Date();
      var date = Formatter.formatDate(today);
      var joiningDate = Formatter.formatDate(oEmpModel.JoiningDate);
      var empName = oEmpModel.Salutation + " " + oEmpModel.EmployeeName;
      var empDesig = oEmpModel.Designation;
      var empID = oEmpModel.EmployeeID;
      this.getView().getModel("PDFData").setProperty("/CreateDate", date);
      this.getView().getModel("PDFData").setProperty("/CertificateTitle", "WORK LETTER");
      var data = `
                <div style="text-align: justify;">
                    <p>This is to certify that <b>${empName}</b>, holding <b>${empID}</b>, was employed with <b>${this.companyName}</b> as a <b>${empDesig}</b> from <b>${joiningDate}</b> to <b>${date}</b> During their tenure with us, they exhibited a high level of professionalism, dedication, and a strong sense of responsibility towards assigned tasks. They consistently met project deadlines, and contributed positively to the success of the team.</p> 
                    <p>${empName} demonstrated sound technical knowledge and excellent interpersonal skills. Maintained good relationships with colleagues, clients, actively participated in various organizational activities.</p>
                    <p>We thank ${empName} for their services and wish them all the very best in their future endeavors.</p>
                </div>`;

      this.getView().getModel("PDFData").setProperty("/RTEText", data);
      this.SS_commonOpenDialog("SSRTE_oDialog", "sap.kt.com.minihrsolution.fragment.CommonRTE");
    },

    SS_onDownloadSalLetter: function () {
      this.getView().getModel("PDFData").setProperty("/OnlyRTEFlag", false);
      var oEmpModel = this.getView().getModel("sEmployeeModel").getData()[0];
      var today = new Date();
      var date = Formatter.formatDate(today);
      var joiningDate = Formatter.formatDate(oEmpModel.JoiningDate);
      var empID = oEmpModel.EmployeeID;
      var empDesig = oEmpModel.Designation;
      var department = oEmpModel.Department;
      var empName = oEmpModel.Salutation + " " + oEmpModel.EmployeeName;
      this.getView().getModel("PDFData").setProperty("/CreateDate", date);
      this.getView().getModel("PDFData").setProperty("/CertificateTitle", "SALARY CERTIFICATE");
      var data = `
                <div style="text-align: justify; font-family: Times;">
                    <p> This is to certify that <b>${empName}</b>, holding the position of <b>${empDesig}</b> with <b>${this.companyName}</b>, has been employed with us since <b>${joiningDate}</b>.</p>
                    <p> As of the date of this certificate, the details of their current salary structure are as follows: </p>
                </div>`;
      this.getView().getModel("PDFData").setProperty("/RTEText", data);
      this.SS_commonOpenDialog("SSRTE_oDialog", "sap.kt.com.minihrsolution.fragment.CommonRTE");
    },

    FCR_onDownloadPDF: async function () {
      const empData = this.getView().getModel("sEmployeeModel").getData()[0];
      if (this.getView().getModel("PDFData").getProperty("/OnlyRTEFlag")) {
        this.generateCertificatePDF(this.getView().getModel("PDFData").getProperty("/RTEText"), empData.CompanyCode);
      } else {
        try {
          const empID = this.getView().getModel("sEmployeeModel").getData()[0].EmployeeID;
          const salaryResponse = await this.ajaxReadWithJQuery("SalaryDetails", { EmployeeID: empID });
          let latestSalary;
          if (Array.isArray(salaryResponse.data)) {
            const sortedSalaries = salaryResponse.data.sort((a, b) => new Date(a.EffectiveDate) - new Date(b.EffectiveDate));
            latestSalary = sortedSalaries[sortedSalaries.length - 1];
          } else {
            latestSalary = salaryResponse.data;
          }
          var oPDFModel = this.getView().getModel("PDFData");
          oPDFModel.setProperty("/YearlyComponents/0/Text", empData.Currency + " " + Formatter.fromatNumber(latestSalary.Total));
          oPDFModel.setProperty("/YearlyComponents/1/Text", empData.Currency + " " + Formatter.fromatNumber(latestSalary.BasicSalary));
          oPDFModel.setProperty("/YearlyComponents/2/Text", empData.Currency + " " + Formatter.fromatNumber(latestSalary.HRA));
          oPDFModel.setProperty("/YearlyComponents/3/Text", empData.Currency + " " + Formatter.fromatNumber(latestSalary.EmployerPF));
          oPDFModel.setProperty("/YearlyComponents/4/Text", empData.Currency + " " + Formatter.fromatNumber(latestSalary.MedicalInsurance));
          oPDFModel.setProperty("/YearlyComponents/5/Text", empData.Currency + " " + Formatter.fromatNumber(latestSalary.Gratuity));
          oPDFModel.setProperty("/Deductions/0/Text", empData.Currency + " " + Formatter.fromatNumber(latestSalary.TotalDeduction));
          oPDFModel.setProperty("/Deductions/1/Text", empData.Currency + " " + Formatter.fromatNumber(latestSalary.IncomeTax));
          oPDFModel.setProperty("/Deductions/2/Text", empData.Currency + " " + Formatter.fromatNumber(latestSalary.EmployeePF));
          oPDFModel.setProperty("/Deductions/3/Text", empData.Currency + " " + Formatter.fromatNumber(latestSalary.PT));
          oPDFModel.setProperty("/VariableComponents/0/Text", empData.Currency + " " + Formatter.fromatNumber(latestSalary.VariablePay));
          oPDFModel.setProperty("/GrossPay/0/Text", empData.Currency + " " + Formatter.fromatNumber(latestSalary.GrossPay));
          oPDFModel.setProperty("/GrossPay/1/Text", empData.Currency + " " + Formatter.fromatNumber(latestSalary.GrossPayMontly));
          oPDFModel.setProperty("/EmpCTC", empData.Currency + " " + Formatter.fromatNumber(latestSalary.CostofCompany));
        } catch (error) {
          MessageToast.show("Failed to fetch salary data.");
        }
        this.SSRTE_oDialog.close();
        var oModel = this.getView().getModel("PDFData").getData();
        // --- Company Details Fetch ---
        let filter = {
          companyCode: this.getView().getModel("sEmployeeModel").getData()[0].CompanyCode
        };
        let apiResponse;
        try {
          apiResponse = await this.ajaxReadWithJQuery("CompanyCodeDetails", filter);
        } catch (err) {
          MessageToast.show(err.message || err.responseText);
          this.closeBusyDialog();
          return;
        }
        const oCompanyDetailsModel = apiResponse.data[0];
        if (!oCompanyDetailsModel) {
          this.closeBusyDialog();
          return;
        }
        if (!oCompanyDetailsModel.companylogo64 && !oCompanyDetailsModel.signature64 && !oCompanyDetailsModel.backgroundLogoBase64) {
          try {
            const logoBlob = new Blob([new Uint8Array(oCompanyDetailsModel.companylogo?.data)], { type: "image/png" });
            const signBlob = new Blob([new Uint8Array(oCompanyDetailsModel.signature?.data)], { type: "image/png" });
            const backgroundBlob = new Blob([new Uint8Array(oCompanyDetailsModel.backgroundLogo?.data)], { type: "image/png" });

            const [logoBase64, signBase64, backgroundBase64] = await Promise.all([this._convertBLOBToImage(logoBlob), this._convertBLOBToImage(signBlob), this._convertBLOBToImage(backgroundBlob)]);

            oCompanyDetailsModel.companylogo64 = logoBase64;
            oCompanyDetailsModel.signature64 = signBase64;
            oCompanyDetailsModel.backgroundLogoBase64 = backgroundBase64;
          } catch (err) {
            console.error("Image compression failed:", err);
            this.closeBusyDialog();
          }
        }
        if (oCompanyDetailsModel.companylogo64 && oCompanyDetailsModel.signature64) {
          if (typeof jsPDF !== "undefined" && typeof jsPDF._GeneratePDF === "function") {
            jsPDF._GeneratePDF(this, sap.ui.getCore().byId("FCR_id_RTE").getValue(), oCompanyDetailsModel, oModel);
          }
        }
      }
    },

    FCR_onCloseDialog: function () {
      this.SSRTE_oDialog.close();
    },

    SS_onDownloadSpotAward: function () {
      var oView = this.getView();
      var resetFields = function () {
        let aInputIds = ["FSA_id_nominatedName"];
        aInputIds.forEach(
          function (sId) {
            let oControl = sap.ui.getCore().byId(sId);
            if (oControl) {
              oControl.setValueState("None");
              oControl.setValue("");
            }
            let oDatePicker = sap.ui.getCore().byId("FSA_id_Date");
            if (oDatePicker) {
              let oToday = this.Formatter.formatDate(new Date());
              oDatePicker.setValue(oToday);
            }
          }.bind(this)
        );
      }.bind(this);
      if (!this.oDialog) {
        sap.ui.core.Fragment.load({
          name: "sap.kt.com.minihrsolution.fragment.SpotAward",
          controller: this,
        }).then(
          function (oDialog) {
            this.oDialog = oDialog;
            oView.addDependent(this.oDialog);
            this.oDialog.attachAfterOpen(resetFields);
            this.oDialog.open();
          }.bind(this)
        );
      } else {
        resetFields();
        this.oDialog.attachAfterOpen(resetFields);
      }
    },

    FSA_onPressSubmit: async function () {
      try {
        // --- Company Details Fetch ---
        let filter = {
          companyCode: this.getView().getModel("sEmployeeModel").getData()[0].CompanyCode,
        };
        let apiResponse;
        try {
          apiResponse = await this.ajaxReadWithJQuery("CompanyCodeDetails", filter);
        } catch (err) {
          MessageToast.show(err.message || err.responseText);
          this.closeBusyDialog();
          return;
        }
        const oComapnyModel = apiResponse.data[0];
        if (!oComapnyModel) {
          this.closeBusyDialog();
          return;
        }

        var coImg = await this._convertBLOBToImage(new Blob([new Uint8Array(oComapnyModel.companylogo?.data)], { type: "image/png" }));

        const oEmpModel = this.getView().getModel("sEmployeeModel").getData();
        const oName = oEmpModel[0].EmployeeName;
        const oNominee = sap.ui.getCore().byId("FSA_id_nominatedName").getValue();
        const oDate = sap.ui.getCore().byId("FSA_id_Date").getValue();

        if (!oNominee || !oDate) {
          sap.m.MessageToast.show("Please fill all required fields.");
          return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
          orientation: "landscape",
          unit: "cm",
          format: "a4",
        });

        // Load fonts
        doc.addFileToVFS(EBGaramond.filename, EBGaramond.base64);
        doc.addFont(EBGaramond.filename, EBGaramond.name, EBGaramond.style);

        doc.addFileToVFS(Allura.filename, Allura.base64);
        doc.addFont(Allura.filename, Allura.name, Allura.style);

        doc.addFileToVFS(Poppins.filename, Poppins.base64);
        doc.addFont(Poppins.filename, Poppins.name, Poppins.style);

        doc.addFileToVFS(Plight.filename, Plight.base64);
        doc.addFont(Plight.filename, Plight.name, Plight.style);

        const pageHeight = doc.internal.pageSize.getHeight();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageMiddle = pageWidth / 2;

        const imgData = this.getView().getModel("PDFData").getProperty("/DemoBase64");
        doc.addImage(imgData, 0, 0, pageWidth, pageHeight);

        doc.setFont(EBGaramond.name, EBGaramond.style);
        doc.setFontSize(37);
        doc.text("SPOT AWARD", pageMiddle, 4, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(20);
        doc.text("This certificate is proudly presented to", pageMiddle, 5.5, { align: "center" });

        doc.setFont(Allura.name, Allura.style);
        doc.setFontSize(45);
        doc.setTextColor(0, 0, 0);
        doc.text(oName, pageMiddle, 8.5, { align: "center" });

        doc.setFont("times", "normal");
        doc.setFontSize(15);
        doc.text(".............................................................................................................................................", pageMiddle, 9.5, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(15);
        doc.text("Excellence in overcoming challenges and timely delivery of solution", pageMiddle, 10.5, { align: "center" });
        doc.text("in new technology areas.", pageMiddle, 11.5, { align: "center" });

        doc.setFont(Poppins.name, Poppins.style);
        doc.setFontSize(16);
        doc.text(oNominee, 7, 15, { align: "center" });
        doc.setFont("times", "normal");
        doc.setFontSize(15);
        doc.text("...............................", 7, 15.5, { align: "center" });

        doc.setFont(Poppins.name, Poppins.style);
        doc.setFontSize(16);
        const formattedDate = sap.ui.core.format.DateFormat.getInstance({ pattern: "dd MMMM yyyy" }).format(sap.ui.core.format.DateFormat.getInstance({ pattern: "dd/MM/yyyy" }).parse(oDate));
        doc.text(formattedDate, pageMiddle, 15, { align: "center" });
        doc.setFont("times", "normal");
        doc.setFontSize(15);
        doc.text("...............................", pageMiddle, 15.5, { align: "center" });

        doc.setFont(Poppins.name, Poppins.style);
        doc.setFontSize(16);
        doc.text(oComapnyModel.headOfCompany, pageWidth - 7, 15, { align: "center" });
        doc.setFont("times", "normal");
        doc.setFontSize(15);
        doc.text("...............................", pageWidth - 7, 15.5, { align: "center" });

        // Labels
        doc.setFont(Plight.name, Plight.style);
        doc.setFontSize(12);
        doc.text("Nominated by", 7, 16, { align: "center" });
        doc.text("Date", pageMiddle, 16, { align: "center" });
        doc.text(oComapnyModel.designation, pageWidth - 7, 16, { align: "center" });

        doc.addImage(coImg, pageWidth - 5, 0.1, 4, 4);
        this.closeBusyDialog();
        doc.save("SpotAward_Certificate.pdf");
        this.oDialog.close();
      } catch (error) {
        sap.m.MessageToast.show("An error occurred while generating the certificate. Please try again.");
      } finally {
        this.closeBusyDialog();
      }
    },

    FSA_onPressClose: function () {
      this.oDialog.close();
    },

    CC_onPressIdCardDetails: function () {
      var oView = this.getView();
      var oEmployeeModel = oView.getModel("sEmployeeModel");
      var employeeData = oEmployeeModel && oEmployeeModel.getData();
      var employeeDetails = employeeData && employeeData[0];

      if (!employeeDetails) {
        sap.m.MessageToast.show("Employee details not found.");
        return;
      }

      var oTextDisplayModel = oView.getModel("TextDisplay");
      if (oTextDisplayModel) {
        oTextDisplayModel.setProperty("/name", "");
      }

      // Prepare ID card data
      var idCardJson = {
        EmployeeID: employeeDetails.EmployeeID || "",
        EmployeeName: employeeDetails.EmployeeName || "",
        Designation: employeeDetails.Designation || "",
        Email: employeeDetails.CompanyEmailID || "",
        BloodGroup: employeeDetails.BloodGroup || "",
        DOB: this.Formatter.formatDate(employeeDetails.DateOfBirth) || "",
        MobileNo: employeeDetails.MobileNo || "",
        BaseLocation: employeeDetails.Branch || "",
        CompanyCode: employeeDetails.CompanyCode || "",
        ProfilePhoto: employeeDetails.ProfilePhoto || "",
      };

      var oIdCardModel = new sap.ui.model.json.JSONModel(idCardJson);
      oView.setModel(oIdCardModel, "IdCardModel");

      // Show busy dialog
      this.getBusyDialog();

      var fnAfterOpen = function () {
        var sFileBinary = employeeDetails.ProfilePhoto;
        var sFileType = employeeDetails.ProfilePhotoType;

        if (sFileBinary && sFileType) {
          try {
            this.onPressDisplayImageOnCanvas(sFileBinary, sFileType);
          } catch (e) {
            console.error("Error displaying image on canvas:", e);
          }
        }
        this.closeBusyDialog();
      }.bind(this);

      if (!this.oIdCardDialog) {
        sap.ui.core.Fragment.load({
          name: "sap.kt.com.minihrsolution.fragment.AddCard",
          controller: this,
        }).then(
          function (oDialog) {
            this.oIdCardDialog = oDialog;
            oView.addDependent(this.oIdCardDialog);
            this.oIdCardDialog.attachAfterOpen(fnAfterOpen); // Attach only once
            this.oIdCardDialog.open();
          }.bind(this)
        );
      } else {
        this.oIdCardDialog.detachAfterOpen(fnAfterOpen); // Detach if already added
        this.oIdCardDialog.attachAfterOpen(fnAfterOpen); // Attach freshly
        this.oIdCardDialog.open();
      }
    },

    CC_onPressSubmit: async function () {
      try {
        const oView = this.getView();
        const oModelData = oView.getModel("IdCardModel").getData();

        const isAllDataPresent = oModelData.EmployeeID && oModelData.EmployeeName && oModelData.Designation && oModelData.Email && oModelData.DOB && oModelData.MobileNo && oModelData.BloodGroup && oModelData.BaseLocation && oModelData.CompanyCode && (oModelData.ProfilePhoto || oModelData.Attachment);

        if (isAllDataPresent) {
          oView.getModel("sEmployeeModel").setProperty("/ProfilePhoto", "");
          oView.getModel("sEmployeeModel").setProperty("/ProfilePhotoType", "");
          this.CC_onPressClose();
          this.onPressMerge(oModelData);
        } else {
          sap.m.MessageToast.show(this.i18nModel.getText("mandetoryFields"));
        }
      } catch (error) {
        sap.m.MessageToast.show(error.message || error.responseText);
      }
    },
    CC_onPressClose: function () {
      this.oIdCardDialog.close();
    },

    onPressMerge: async function (employeeDetails) {
      const { jsPDF } = window.jspdf;
      this.getBusyDialog(); // open BusyDialog immediately
      try {
        // --- Company Details Fetch ---
        let filter = {
          companyCode: employeeDetails.CompanyCode
        };
        let apiResponse;
        try {
          apiResponse = await this.ajaxReadWithJQuery("CompanyCodeDetails", filter);
        } catch (err) {
          MessageToast.show(err.message || err.responseText);
          this.closeBusyDialog();
          return;
        }
        const oCompanyDetailsModel = apiResponse.data[0];
        if (!oCompanyDetailsModel) {
          this.closeBusyDialog();
          return;
        }
        const compLogoBase64 = this._convertBLOBtoBASE64(oCompanyDetailsModel.transparentComplogo?.data);
        const templateBase64 = this._convertBLOBtoBASE64(oCompanyDetailsModel.idCardTemplate?.data);
        const address = oCompanyDetailsModel.shortAddress;

        // Create the PDF document
        const doc = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: [54, 86], // Standard ID card size
        });
        // Set the background template
        if (templateBase64) {
          doc.addImage(templateBase64, "JPEG", 0, 0, 54, 86);
        }
        // company logo at top-right corner
        if (compLogoBase64) {
          doc.addImage(compLogoBase64, "JPEG", 40, 2.5, 12, 12); // logo at top-right
        }
        // Define the photo placeholder
        const imageWidth = 20;
        const imageHeight = 20;
        const imageX = (54 - imageWidth) / 2; // Center horizontally
        const imageY = 20;
        // Set the border around the employee photo placeholder
        doc.setDrawColor(72, 61, 139);
        doc.setLineWidth(1);
        // Draw the border exactly around the photo
        doc.rect(imageX, imageY, imageWidth, imageHeight);
        // Add a white rectangle as a placeholder for the employee photo
        doc.setFillColor(255, 255, 255); // Fill color as white
        doc.rect(imageX, imageY, imageWidth, imageHeight, "F");
        // Add employee image
        if (employeeDetails.Attachment) {
          doc.addImage(employeeDetails.Attachment, "JPEG", imageX, imageY, imageWidth, imageHeight);
        } else if (employeeDetails.ProfilePhoto) {
          doc.addImage(employeeDetails.ProfilePhoto, "JPEG", imageX, imageY, imageWidth, imageHeight);
        }
        // Employee details below the image
        const textStartY = imageY + imageHeight + 5;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        // Center employee name and designation
        const pageWidth = doc.internal.pageSize.getWidth();
        const employeeNameX = (pageWidth - doc.getTextWidth(employeeDetails.EmployeeName)) / 2;
        const designationX = (pageWidth - doc.getTextWidth(employeeDetails.Designation)) / 2;
        doc.text(employeeDetails.EmployeeName, employeeNameX, textStartY);
        doc.text(employeeDetails.Designation, designationX, textStartY + 5);
        // Other details
        const lineHeight = 5;
        const textYOffset = textStartY + 10;
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        const centerText = (text) => (pageWidth - doc.getTextWidth(text)) / 2;
        doc.text(`Employee ID: ${employeeDetails.EmployeeID}`, centerText(`Employee ID: ${employeeDetails.EmployeeID}`), textYOffset);
        doc.text(`DOB: ${employeeDetails.DOB}`, centerText(`DOB: ${employeeDetails.DOB}`), textYOffset + lineHeight);
        doc.text(`Blood: ${employeeDetails.BloodGroup}`, centerText(`Blood: ${employeeDetails.BloodGroup}`), textYOffset + lineHeight * 2);
        doc.text(`Phone: ${employeeDetails.MobileNo}`, centerText(`Phone: ${employeeDetails.MobileNo}`), textYOffset + lineHeight * 3);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        const maxWidth = 44;
        const addressLines = doc.splitTextToSize(address, maxWidth);
        let addressY = textYOffset + lineHeight * 3 + 5;
        addressLines.forEach((line, index) => {
            const x = (pageWidth - doc.getTextWidth(line)) / 2;
            doc.text(line, x, addressY + (index * 4)); // 4 = line spacing (adjust if needed)
        });
        // Save the document
        doc.save(`${employeeDetails.EmployeeName}_IDCard.pdf`);
      } catch (error) {
        sap.m.MessageToast.show(error.message || error.responseText);
      } finally {
        this.closeBusyDialog();
      }
    },

    SS_onPressPayslipRow: function (oEvent) {
      var sPath = oEvent.getSource().getBindingContext("PaySlip").getPath();
      this.oModel.setProperty("/isCreate", false);
      this.oModel.setProperty("/isIdSelected", true);
      this.oModel.setProperty("/EmpData", {});
      this.oModel.setProperty("/BackRoute", "SelfService");
      this.oModel.setProperty("/BackPath", this.sPath);
      this.oModel.setProperty("/BackPathRole", this.sNavigatedRole);
      var month = this.oModel.getProperty(`${sPath}/YearMonth`).split("-")[1];
      var filters = {
        ID: this.oModel.getProperty(`${sPath}/ID`),
        EmployeeID: this.oModel.getProperty(`${sPath}/EmployeeID`),
        FinancialYear: this.oModel.getProperty(`${sPath}/FinancialYear`),
        Month: month,
      };
      this.oModel.setProperty("/SelectedFilters", filters);
      this.getRouter().navTo("RouteNavAdminPaySlipApp");
    },

    onApplyResignation: async function () {
      await this.SS_commonOpenDialog("SSReg_oDialog", "sap.kt.com.minihrsolution.fragment.Resignation", ["RF_id_StartDate", "RF_id_EndDate"]);
      let oModel = this.getView().getModel("sEmployeeModel");
      let oData = oModel.getProperty("/0");
      if (oData && (!oData.ResignationStartDate || !oData.ResignationEndDate || !oData.ResignComment)) {
        // Data not loaded yet, fetch and retry
        await this._fetchCommonData("EmployeeDetails", "sEmployeeModel", { EmployeeID: this.EmployeeID });
        oModel = this.getView().getModel("sEmployeeModel");
        oData = oModel.getProperty("/0");
      }
      if (oData && oData.ResignationStartDate && oData.ResignationEndDate && oData.ResignComment) {
        this.getView().getModel("viewModel").setProperty("/backButtonVisible", false);
        this.getView().getModel("viewModel").setProperty("/BtnVisible", false);
        this.getView().getModel("viewModel").setProperty("/CanWithdrawResignation", true);
        this.getView().getModel("viewModel").setProperty("/editableResignatin", false);
        // this.getView().getModel("viewModel").setProperty("/closeButtonVisible", true)
        this._onPressPreview("Initial");
      } else {
        this.getView().getModel("viewModel").setProperty("/backButtonVisible", false);
        //  this.getView().getModel("viewModel").setProperty("/closeButtonVisible", true)
        this.getView().getModel("viewModel").setProperty("/BtnVisible", true);
        this.getView().getModel("viewModel").setProperty("/CanWithdrawResignation", false);
        this.getView().getModel("viewModel").setProperty("/editableResignatin", true);
        this.getView().getModel("PDFData").setProperty("/RTEText", "<p>Please click on <b>Preview Certificate</b> to Preview the Certificate</p>");
        this.getView().getModel("PDFData").setProperty("/PreviewFlag", false);
      }
    },

    RF_onPressCloseDialog: function () {
      const oVM = this.getView().getModel("viewModel");
      const oCommentField = sap.ui.getCore().byId("RF_id_ResignReason");

      if (oVM.getProperty("/isWithdrawMode")) {
        // Cancel withdraw → reset
        oVM.setProperty("/isWithdrawMode", false);
        oVM.setProperty("/closeButtonText", this.i18nModel.getText("close"));
        oVM.setProperty("/editableWithdrawComment", false);
        oVM.setProperty("/commentLabel", this.i18nModel.getText("resignComment"));

        const sOriginalComment = oVM.getProperty("/originalComment") || "";
        oCommentField.setEditable(false);
        oCommentField.setValue(sOriginalComment);

        sap.m.MessageToast.show(this.i18nModel.getText("withdrawCancelMsg") || "Withdrawal canceled");

        this.SSReg_oDialog.close();
        return;
      }

      // Normal close case
      if (!oVM.getProperty("/CanWithdrawResignation")) {
        sap.ui.getCore().byId("RF_id_StartDate").setValue("");
        sap.ui.getCore().byId("RF_id_EndDate").setValue("");
        sap.ui.getCore().byId("RF_id_ResignReason").setValue("");
        sap.ui.getCore().byId("RF_id_ResignReason").setValueState("None");
        this.getView().getModel("PDFData").setProperty("/PreviewFlag", false);
        this.getView().getModel("PDFData").setProperty("/RTEText", "<p>Please click on <b>Preview Certificate</b> to Preview the Certificate</p>");
      }

      this.SSReg_oDialog.close();
      this.SSReg_oDialog.destroy();
      this.SSReg_oDialog = null;
    },

    RF_onPressHandlePreview: function () {
      const bPreviewFlag = this.getView().getModel("PDFData").getProperty("/PreviewFlag");
      if (bPreviewFlag) {
        this._onPressApplyResign();
      } else {
        this._onPressPreview("Preview");
      }
    },

    //download certificate
    _onPressPreview: function (flag) {
      var oEmployeeModel = this.getView().getModel("sEmployeeModel").getData()[0];
      var startDate = Formatter.formatDate(oEmployeeModel.ResignationStartDate);
      var endDate = Formatter.formatDate(oEmployeeModel.ResignationEndDate);
      if (flag !== "Initial") {
        if (!utils._LCvalidateMandatoryField(sap.ui.getCore().byId("RF_id_ResignReason"), "ID") || !utils._LCvalidateDate(sap.ui.getCore().byId("RF_id_StartDate"), "ID") || !utils._LCvalidateDate(sap.ui.getCore().byId("RF_id_EndDate"), "ID")) {
          MessageToast.show(this.i18nModel.getText("mandetoryFields"));
          return;
        }

        var startDate = sap.ui.getCore().byId("RF_id_StartDate").getValue();
        var endDate = sap.ui.getCore().byId("RF_id_EndDate").getValue();
      }
      var empName = oEmployeeModel.Salutation + " " + oEmployeeModel.EmployeeName;
      var joinDate = Formatter.formatDate(oEmployeeModel.JoiningDate);
      var resignComment = oEmployeeModel.ResignComment;
      var designation = oEmployeeModel.Designation;
      var managerName = oEmployeeModel.ManagerName;

      var data = `
                <div style="text-align: justify;">
                    <p>Dear <b>${managerName}</b>,</p>  
                    <p>I hope this message finds you well.</p>
                    <p>I <b>${empName}</b> writing to formally resign from my position as <b>${designation}</b> at <b>${this.companyName}</b>, effective <b>${startDate}</b>. My last working day will be <b>${endDate}</b>.</p>
                    <p>I joined this organization on <b>${joinDate}</b>, and it has been an incredibly rewarding journey filled with learning, professional growth, and meaningful relationships. I want to sincerely thank you for your guidance and support throughout my tenure.</p>
                    <p>The reason of resignation is as follows:</p>
                    <p>${resignComment}</p>                   
         <p>I will do my best during this transition period to ensure a smooth handover of my responsibilities. Please let me know how I can help during this time.</p>
        <p>Thanks & Best Regards,<br/>
        ${empName}<br/>
        ${designation}<br/>
        ${this.companyName}</p>
    </div>
`;
      this.getView().getModel("PDFData").setProperty("/RTEText", data);
      this.getView().getModel("PDFData").setProperty("/PreviewFlag", true);
      if (flag !== "Preview") {
        if (new Date(oEmployeeModel.ResignationEndDate) < new Date()) {
          this.getView().getModel("viewModel").setProperty("/BtnVisible", false);
          this.getView().getModel("viewModel").setProperty("/CanWithdrawResignation", false);
        } else {
          this.getView().getModel("viewModel").setProperty("/CanWithdrawResignation", true);
        }
      }
    },
    SS_ResignStartDateChange: function (oEvent) {
      var oStartDate = oEvent.getSource().getDateValue(); // Get selected Start Date
      var oEndDatePicker = sap.ui.getCore().byId("RF_id_EndDate");
      if (oStartDate) {
        // Set min date for end date
        oEndDatePicker.setMinDate(oStartDate);
        // Calculate 60 days after start date
        var oEndDate = new Date(oStartDate);
        oEndDate.setDate(oEndDate.getDate() + 60);
        // Set the value of End Date picker (format as needed)
        var oLocale = sap.ui.getCore().getConfiguration().getFormatSettings().getFormatLocale();
        var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "dd/MM/yyyy", locale: oLocale });
        oEndDatePicker.setValue(oDateFormat.format(oEndDate));
      }
      utils._LCvalidateDate(oEvent.getSource(), "ID");
    },
    //apply for resignation send mail to manager
    _onPressApplyResign: async function () {
      var that = this;
      this.showConfirmationDialog(
        this.i18nModel.getText("confirmTitle"),
        this.i18nModel.getText("confirmResgn"),
        async function () {
          try {
            // Validate fields
            if (!utils._LCvalidateMandatoryField(sap.ui.getCore().byId("RF_id_ResignReason"), "ID") || !utils._LCvalidateDate(sap.ui.getCore().byId("RF_id_StartDate"), "ID") || !utils._LCvalidateDate(sap.ui.getCore().byId("RF_id_EndDate"), "ID")) {
              MessageToast.show(that.i18nModel.getText("mandetoryFields"));
              return;
            }
            var oEmployeeModel = that.getView().getModel("sEmployeeModel").getData()[0];
            oEmployeeModel.ResignationStartDate = sap.ui.getCore().byId("RF_id_StartDate").getValue();
            oEmployeeModel.ResignationEndDate = sap.ui.getCore().byId("RF_id_EndDate").getValue();
            oEmployeeModel.resignComment = sap.ui.getCore().byId("RF_id_ResignReason").getValue();
            var empName = oEmployeeModel.Salutation + " " + oEmployeeModel.EmployeeName;
            var startDate = sap.ui.getCore().byId("RF_id_StartDate").getValue().split("/").reverse().join("-");
            var endDate = sap.ui.getCore().byId("RF_id_EndDate").getValue().split("/").reverse().join("-");
            var resignComment = sap.ui.getCore().byId("RF_id_ResignReason").getValue();
            var subject = `Resignation Notice: ${empName}`;
            // Use the RTE content as the email body
            var body = sap.ui.getCore().byId("RF_id_RTE").getValue();
            delete oEmployeeModel.comments;
            var oPayload = {
              from: oEmployeeModel.CompanyEmailID,
              fromName: empName,
              to: "",
              toName: "",
              subject: subject,
              body: body,
              CC: [oEmployeeModel.CompanyEmailID],
              EmployeeID: that.EmployeeID,
              ResignationStartDate: startDate,
              ResignationEndDate: endDate,
              ResignComment: resignComment,
              Inbox: oEmployeeModel,
            };
            that.getBusyDialog();
            await that.ajaxCreateWithJQuery("ResignationMail", oPayload);
            MessageToast.show(that.i18nModel.getText("resignConfirmation"));
            // Show Withdraw button (set a flag in your model)
            that.getView().getModel("viewModel").setProperty("/CanWithdrawResignation", true);
            that.getView().getModel("viewModel").setProperty("/BtnVisible", false);
            that.getView().getModel("viewModel").setProperty("/editableResignatin", false);
            that.SSReg_oDialog.close();
          } catch (error) {
            MessageToast.show(error.message || "Failed to send resignation email.");
          } finally {
            that.closeBusyDialog();
          }
        },
        function () { }
      );
    },
    onWithdrawResignation: function () {
      var that = this;
      const oVM = this.getView().getModel("viewModel");
      const oEmpModel = this.getView().getModel("sEmployeeModel");
      const oCommentField = sap.ui.getCore().byId("RF_id_ResignReason");
      const oStartDatePicker = sap.ui.getCore().byId("RF_id_StartDate");
      const oEndDatePicker = sap.ui.getCore().byId("RF_id_EndDate");

      const sStartDate = oEmpModel.getProperty("/0/ResignationStartDate");
      const sEndDate = oEmpModel.getProperty("/0/ResignationEndDate");
      const sOriginalComment = oEmpModel.getProperty("/0/ResignComment") || "";

      const parseDate = (sDate) => {
        if (!sDate) return null;
        const isoDate = new Date(sDate);
        if (!isNaN(isoDate.getTime())) return isoDate;

        const parts = sDate.split("/");
        if (parts.length === 3) {
          const [day, month, year] = parts.map(Number);
          const d = new Date(year, month - 1, day);
          return isNaN(d.getTime()) ? null : d;
        }
        return null;
      };

      const restoreDates = () => {
        setTimeout(() => {
          const startDateObj = parseDate(sStartDate);
          const endDateObj = parseDate(sEndDate);
          if (startDateObj) oStartDatePicker.setDateValue(startDateObj);
          if (endDateObj) oEndDatePicker.setDateValue(endDateObj);
        }, 50);
      };

      // --- CASE 1: Enter withdraw mode ---
      if (!oVM.getProperty("/isWithdrawMode")) {
        oVM.setProperty("/isWithdrawMode", true);
        oVM.setProperty("/closeButtonText", this.i18nModel.getText("cancel"));
        oVM.setProperty("/editableWithdrawComment", true);
        oVM.setProperty("/commentLabel", this.i18nModel.getText("withdrawComment"));

        // Save original comment for cancel restore
        oVM.setProperty("/originalComment", sOriginalComment);

        oCommentField.setEditable(true);
        oCommentField.setValue("");

        restoreDates();

        MessageBox.information(this.i18nModel.getText("fillWithdrawReason"));
        return;
      }

      // --- CASE 2: Submit withdraw ---
      const sComment = oCommentField.getValue().trim();
      if (!sComment) {
        oCommentField.setValueState("Error");
        oCommentField.setValueStateText(this.i18nModel.getText("withdrawReasonRequired"));
        return;
      }

      // Clear error once valid
      oCommentField.setValueState("None");

      const oEmployeeModel = oEmpModel.getProperty("/0");
      var empName = oEmployeeModel.Salutation + " " + oEmployeeModel.EmployeeName;
      var designation = oEmployeeModel.Designation;
      var subject = "Confirmation of Resignation Withdrawal";

      var body = `
    <div style="text-align: justify; font-family: Arial, sans-serif;">
        <p>Dear <b>${empName}</b>,</p>
        <p>We acknowledge receipt of your request to withdraw your resignation from the position of <b>${designation}</b> at <b>${that.companyName}</b>.</p>
        <p>We are pleased to inform you that your request has been accepted, and your resignation has been officially withdrawn. You will continue in your current role with no change to your employment status or responsibilities.</p>
        <p>We appreciate your continued commitment to the organization and look forward to your continued contributions.</p>
        <p>Best regards,<br/>
        HR Department<br/>
        ${that.companyName}</p>
    </div>
`;

      const oPayload = {
        isWithdraw: "isWithdraw",
        from: oEmployeeModel.CompanyEmailID,
        ResignComment: sComment,
        fromName: empName,
        subject: subject,
        to: empName,
        subject: "Confirmation of Resignation Withdrawal",
        body: body,
        CC: [oEmployeeModel.CompanyEmailID],
        EmployeeID: this.EmployeeID,
        Inbox: oEmployeeModel,
      };

      this.getBusyDialog();
      this.ajaxCreateWithJQuery("ResignationMail", oPayload)
        .then(() => {
          MessageToast.show(this.i18nModel.getText("resignWithdrw") || "Resignation letter withdrawn");
          oVM.setProperty("/CanWithdrawResignation", false);

          // Reset UI fields
          oCommentField.setValue("");
          oStartDatePicker.setValue("");
          oEndDatePicker.setValue("");

          const oPDFModel = this.getView().getModel("PDFData");
          oPDFModel.setProperty("/PreviewFlag", false);
          oPDFModel.setProperty("/RTEText", "<p>Please click on <b>Preview Certificate</b> to Preview the Certificate</p>");

          oVM.setProperty("/editableResignatin", true);
          oVM.setProperty("/BtnVisible", true);
          oVM.setProperty("/editableWithdrawComment", false);
          oVM.setProperty("/commentLabel", this.i18nModel.getText("resignComment"));

          // reset button back to "Close"
          oVM.setProperty("/isWithdrawMode", false);
          oVM.setProperty("/closeButtonText", this.i18nModel.getText("close"));

          this.SSReg_oDialog.close();
        })
        .catch((error) => {
          MessageToast.show(error.message || "Failed to withdraw resignation.");
        })
        .finally(() => {
          this.closeBusyDialog();
        });
    },

    // --- SEPARATE CANCEL HANDLER ---
    onWithdrawCancel: function () {
      const oVM = this.getView().getModel("viewModel");
      const oCommentField = sap.ui.getCore().byId("RF_id_ResignReason");

      const sRestoreComment = oVM.getProperty("/originalComment") || "";

      oVM.setProperty("/isWithdrawMode", false);
      oVM.setProperty("/closeButtonText", this.i18nModel.getText("close"));
      oVM.setProperty("/editableWithdrawComment", false);
      oVM.setProperty("/commentLabel", this.i18nModel.getText("resignComment"));

      oCommentField.setEditable(false);
      oCommentField.setValue(sRestoreComment);

      sap.m.MessageToast.show(this.i18nModel.getText("withdrawCancelMsg") || "Withdrawal canceled");

      this.SSReg_oDialog.close();
    },

    onExperienceSelect: function (oEvent) {
      const iSelectedIndex = oEvent.getParameter("selectedIndex");
      const bIsExperiencedSelected = iSelectedIndex === 1;
      this.ViewModel.setProperty("/employmentSectionVisible", bIsExperiencedSelected);
      if (iSelectedIndex === 0) {
        this.ViewModel.setProperty("/employeeType", "Fresher");
      } else if (iSelectedIndex === 1) {
        this.ViewModel.setProperty("/employeeType", "Experienced");
      }
    },
    formatCommentValue: function (sResignComment, sWithdrawReason, bIsWithdrawMode) {
      return bIsWithdrawMode ? sWithdrawReason : sResignComment;
    },
    onCommentChange: function (oEvent) {
      const oVM = this.getView().getModel("viewModel");
      const oResignModel = this.getView().getModel("ResignationData");
      const sNewValue = oEvent.getParameter("value");

      if (oVM.getProperty("/isWithdrawMode")) {
        oVM.setProperty("/WithdrawReason", sNewValue);
      } else {
        oResignModel.setProperty("/ResignComment", sNewValue);
      }
    },
    onShowMore: async function () {
      this.getBusyDialog();
      const response = await this.ajaxReadWithJQuery("AllComments", {
        ApplicationName: "Resignation",
      });
      const aAllComments = response.data || [];
      this.closeBusyDialog();

      var oEmployeeData = this.getView().getModel("sEmployeeModel").getData()[0];
      var sEmpID = oEmployeeData.ID;

      var aFilteredComments = aAllComments.filter(function (oComment) {
        return oComment.ApplicationName === "Resignation" && oComment.ID === sEmpID;
      });

      let oContent;

      if (aFilteredComments.length === 0) {
        // Show "No Data" message
        oContent = new sap.m.VBox({
          alignItems: "Center",
          justifyContent: "Center",
          items: [new sap.m.Text({ text: "No Data Found", design: "Bold" })],
        }).addStyleClass("sapUiSmallMargin");
      } else {
        // Map into Timeline Items
        var aTimelineItems = aFilteredComments
          .slice()
          .reverse()
          .map(function (oComment) {
            return new sap.suite.ui.commons.TimelineItem({
              dateTime: new Date(oComment.CommentDateTime).toLocaleString(),
              title: (oComment.CommentedBy || "Anonymous") + " (" + (oComment.Status || "No Status") + ")",
              text: oComment.Comment || "No comment provided",
              userNameClickable: false,
              icon: "sap-icon://comment",
            });
          });

        // Create Timeline
        oContent = new sap.suite.ui.commons.Timeline({
          showHeader: false,
          enableBusyIndicator: false,
          width: "100%",
          sortOldestFirst: false,
          enableDoubleSided: false,
          content: aTimelineItems,
          showHeaderBar: false,
        });
      }

      // Dialog
      var oDialog = new sap.m.Dialog({
        title: "Resignation Comments",
        contentWidth: "25rem",
        contentHeight: "15rem",
        draggable: true,
        resizable: true,
        content: [oContent],
        endButton: new sap.m.Button({
          text: "Close",
          type: "Transparent",
          press: function () {
            oDialog.close();
            oDialog.destroy();
          },
        }),
      });

      oDialog.open();
    },
    AddEd_changeDegree: function (oEvent) {
      utils._LCstrictValidationComboBox(oEvent.getSource(), "ID");
    },

    SS_onDownloadBulkPayslip: function () {
      if (!this.BPD_oDialog) {
        sap.ui.core.Fragment.load({
          name: "sap.kt.com.minihrsolution.fragment.BulkPayslipDownload",
          controller: this,
        }).then(function (oDialog) {
          this.BPD_oDialog = oDialog;
          this.getView().addDependent(this.BPD_oDialog);
          this.BPD_oDialog.open();
        }.bind(this));
      } else {
        this.BPD_oDialog.open();
      }
    },

    BPD_onPressDownload: async function () {
      const sFinancialYear = this.oModel.getProperty("/SelectedFinancialYear");
      if (!sFinancialYear) {
        sap.m.MessageToast.show("Please select Financial Year");
        return;
      }

      // 1. Get all employee records and filter by the selected Financial Year
      const aEmpTable = this.oModel.getProperty("/EmpTable") || [];
      const aFilteredMonths = aEmpTable.filter(item => item.FinancialYear === sFinancialYear);

      // If there are no records for this financial year, stop execution
      if (aFilteredMonths.length === 0) {
        sap.m.MessageBox.information("No payslip data found for the selected Financial Year.");
        return;
      }

      this.BPD_oDialog.close();
      // Notify the user immediately
      sap.m.MessageToast.show("Preparing payslips in the background. The download will begin shortly...");

      try {
        // 2. Map the filtered records to generate parallel requests ONLY for existing months
        const aMonthPromises = aFilteredMonths.map(item => {
          // Extract the month "MM" from "YYYY-MM-DD..." format
          let sMonth = item.YearMonth ? item.YearMonth.split("-")[1] : "";

          let filters = {
            ID: item.ID,                 // Exact unique ID from the filtered table
            EmployeeID: item.EmployeeID,
            FinancialYear: item.FinancialYear,
            Month: sMonth
          };
          return this.ajaxCreateWithJQuery("createUpdateAllData", filters);
        });

        // Wait for all specific backend calls to resolve
        const aResponses = await Promise.all(aMonthPromises);
        const aValidMonthsData = [];

        // 3. Process each response
        for (let i = 0; i < aResponses.length; i++) {
          let response = aResponses[i];

          if (response.success && response.data && response.data.AdminPaySlip && response.data.AdminPaySlip.length > 0) {
            let oData = response.data.AdminPaySlip[0];

            oData.EarningData = (response.data.Earning || []).filter(function (item) {
              return !(item.Amount == null && item.YearlyAmount == null);
            });
            oData.DeductionData = (response.data.Deduction || []).filter(function (item) {
              return !(item.Amount == null && item.YearlyAmount == null);
            });

            if (oData.EarningData.length === 0) continue;

            // Calculation logic mapped directly to the local oData object
            const getTotal = (data, key) => data.reduce((total, item) => total + Number(item[key] || 0), 0);
            oData.EarningsTotalMonthly = Math.max(0, getTotal(oData.EarningData, "Amount"));
            oData.EarningsTotalYearly = Math.max(0, getTotal(oData.EarningData, "YearlyAmount"));
            oData.DeductionsTotalMonthly = Math.max(0, getTotal(oData.DeductionData, "Amount"));
            oData.DeductionsTotalYearly = Math.max(0, getTotal(oData.DeductionData, "YearlyAmount"));

            let totalNetPay = +((oData.EarningsTotalMonthly - oData.DeductionsTotalMonthly).toFixed(2));
            if (totalNetPay < 0) totalNetPay = 0;

            oData.NetPay = totalNetPay;
            oData.NetPayText = await this.convertNumberToWords(totalNetPay, "INR");

            // Fallback: Ensure YearMonth is present for PDF naming/header
            if (!oData.YearMonth) {
              oData.YearMonth = aFilteredMonths[i].YearMonth;
            }

            aValidMonthsData.push(oData);
          }
        }

        if (aValidMonthsData.length === 0) {
          sap.m.MessageBox.information("Unable to retrieve valid payslip details from the server.");
          return;
        }

        // 4. One-time call for Company Details
        // Using CompanyCode from the first valid item
        let companyCodeFilter = { companyCode: aValidMonthsData[0].CompanyCode || aFilteredMonths[0].CompanyCode };
        let apiResponse = await this.ajaxReadWithJQuery("CompanyCodeDetails", companyCodeFilter);
        const oCompanyDetailsModel = apiResponse.data[0];

        if (!oCompanyDetailsModel.companylogo64 && !oCompanyDetailsModel.backgroundLogoBase64) {
          const logoBlob = new Blob([new Uint8Array(oCompanyDetailsModel.companylogo?.data)], { type: "image/png" });
          const backgroundBlob = new Blob([new Uint8Array(oCompanyDetailsModel.backgroundLogo?.data)], { type: "image/png" });
          const [logoBase64, backgroundBase64] = await Promise.all([
            this._convertBLOBToImage(logoBlob),
            this._convertBLOBToImage(backgroundBlob)
          ]);
          oCompanyDetailsModel.companylogo64 = logoBase64;
          oCompanyDetailsModel.backgroundLogoBase64 = backgroundBase64;
        }

        // 5. Generate PDFs and compress them into a .zip file
        const zip = new window.JSZip(); // Ensure window.JSZip is accessible
        const sEmployeeID = aFilteredMonths[0].EmployeeID;

        for (let oMonthData of aValidMonthsData) {
          // NOTE: Replace 'formatter' with whatever alias you used to import your PDF generation file at the top of this controller
          let pdfBlob = jsPayslipPDF._GeneratePDF(this, oMonthData, oCompanyDetailsModel, true);

          // Extract clean Year and Month for the filename (e.g., "2026-04")
          let sYearMonth = oMonthData.YearMonth ? oMonthData.YearMonth.split("T")[0].substring(0, 7) : "UnknownMonth";
          let fileName = `${sEmployeeID}_PaySlip_${sYearMonth}.pdf`;

          zip.file(fileName, pdfBlob);
        }

        // 6. Trigger Download of the .zip file
        zip.generateAsync({ type: "blob" }).then(function (content) {
          const url = window.URL.createObjectURL(content);
          const a = document.createElement("a");
          a.style.display = "none";
          a.href = url;
          a.download = `Payslips_${sEmployeeID}_${sFinancialYear}.zip`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        });

      } catch (err) {
        sap.m.MessageBox.error("An error occurred while preparing the payslips: " + (err.message || err.responseText));
      }
    },

    BPD_onPressClose: function () {
      this.BPD_oDialog.close();
    },

    SS_onDownloadConsentLetter: async function () {
        try {
            this.getBusyDialog();

            let oEmpData = this.getView().getModel("sEmployeeModel").getData()[0];

            const oSalaryResponse = await this.ajaxReadWithJQuery("SalaryDetails", {
                EmployeeID: this.EmployeeID
            });

            let aData = oSalaryResponse.data;
            let oSalaryData = {};

            if (Array.isArray(aData) && aData.length > 0) {

                // Sort by EffectiveDate (oldest first)
                aData.sort((a, b) => new Date(a.EffectiveDate) - new Date(b.EffectiveDate));

                // Always pick OLDEST (correct for your case)
                oSalaryData = aData[0];

            } else {
                oSalaryData = aData;
            }

            let oFinalData = {
                ...oEmpData,
                ...oSalaryData
            };

            const oFinalModel = new sap.ui.model.json.JSONModel(oFinalData);

            this.offerGeneratingPdfFunction(oFinalModel);

            this.closeBusyDialog();

        } catch (err) {
            sap.m.MessageToast.show(err.message || err.responseText);
            this.closeBusyDialog();
        }
    },

    offerGeneratingPdfFunction: async function (oModel) {
        this.getBusyDialog();

        const _setIfNotZero = (model, path, value, currency) => {
            if (value && Number(value) !== 0) {
                model.setProperty(path, currency + " " + Formatter.fromatNumber(value));
            } else {
                model.setProperty(path, "");
            }
        };

        try {
            var oEmpModel = oModel.getData();
            await this._fetchCommonData("PDFCondition", "PDFConditionModel", { Type: "EmployeeConsent" });
            var oPDFModel = this.getView().getModel("PDFData");

             // Employee details mapping
            oPDFModel.setProperty("/Type", "Employee Offer");
            oPDFModel.setProperty("/EmpID", oEmpModel.EmployeeID || "");
            oPDFModel.setProperty("/EmpName",(oEmpModel.Salutation || "") + " " + (oEmpModel.EmployeeName || ""));
            oPDFModel.setProperty("/EmpRole", oEmpModel.Designation || "");
            oPDFModel.setProperty("/EmpAddress",(oEmpModel.CorrespondenceAddress || "").replace(/\n/g, ", "));
            oPDFModel.setProperty("/CreateDate", Formatter.formatDate(oEmpModel.AppraisalDate));
            oPDFModel.setProperty("/JoiningDate",Formatter.formatDate(oEmpModel.JoiningDate));
            oPDFModel.setProperty("/EmpCTC",(oEmpModel.Currency || "INR") + " " + Formatter.fromatNumber(oEmpModel.CTC || oEmpModel.CostofCompany));

            // Bond Condition
            if (!oEmpModel.EmploymentBond || oEmpModel.EmploymentBond === "0") {
                oPDFModel.setProperty("/BondCondition", "18 employment months");
                oPDFModel.setProperty("/BondCondition2", "");
            } else {
                oPDFModel.setProperty("/BondCondition", oEmpModel.EmploymentBond + " employment bond year(s)");
                if (oEmpModel.EmploymentBond === "1") {
                    oPDFModel.setProperty(
                        "/BondCondition2",
                        "any training costs and during 18 employment months, "
                    );
                } else {
                    oPDFModel.setProperty(
                        "/BondCondition2",
                        "any training costs and "
                    );
                }
            }

            // Yearly Components / Deductions / Variable / GrossPay
            const currency = oEmpModel.Currency || "INR";

            _setIfNotZero(oPDFModel, "/YearlyComponents/0/Text", oEmpModel.Total, currency);
            _setIfNotZero(oPDFModel, "/YearlyComponents/1/Text", oEmpModel.BasicSalary, currency);
            _setIfNotZero(oPDFModel, "/YearlyComponents/2/Text", oEmpModel.HRA, currency);
            _setIfNotZero(oPDFModel, "/YearlyComponents/3/Text", oEmpModel.EmployerPF, currency);
            _setIfNotZero(oPDFModel, "/YearlyComponents/4/Text", oEmpModel.MedicalInsurance, currency);
            _setIfNotZero(oPDFModel, "/YearlyComponents/5/Text", oEmpModel.Gratuity, currency);
            _setIfNotZero(oPDFModel, "/YearlyComponents/6/Text", oEmpModel.SpecailAllowance, currency);
    
            _setIfNotZero(oPDFModel, "/Deductions/0/Text", oEmpModel.TotalDeduction, currency);
            _setIfNotZero(oPDFModel, "/Deductions/1/Text", oEmpModel.IncomeTax, currency);
            _setIfNotZero(oPDFModel, "/Deductions/2/Text", oEmpModel.EmployeePF, currency);
            _setIfNotZero(oPDFModel, "/Deductions/3/Text", oEmpModel.PT, currency);

            _setIfNotZero(oPDFModel, "/VariableComponents/0/Text", oEmpModel.VariablePay, currency);

            _setIfNotZero(oPDFModel, "/GrossPay/0/Text", oEmpModel.GrossPay, currency);
            _setIfNotZero(oPDFModel, "/GrossPay/1/Text", oEmpModel.GrossPayMontly, currency);

            if (!oEmpModel.JoiningBonus || oEmpModel.JoiningBonus === "0") {
                oPDFModel.setProperty("/Notes/0/Text", "0");
            } else {
                oPDFModel.setProperty(
                    "/Notes/0/Text",
                    currency + " " + Formatter.fromatNumber(oEmpModel.JoiningBonus)
                );
            }

             /// --- Company Details Fetch ---
                    let filter = { companyCode: oEmpModel.CompanyCode };
                    let apiResponse;
                    try {
                        apiResponse = await this.ajaxReadWithJQuery("CompanyCodeDetails", filter);
                    } catch (err) {
                        MessageToast.show(err.message || err.responseText);
                        this.closeBusyDialog();
                        return;
                    }

                    const oCompanyDetailsModel = apiResponse.data[0];
                    oPDFModel.setProperty("/Headers/0/Text", oCompanyDetailsModel.companyName);
                    oPDFModel.setProperty("/Headers/1/Text", oCompanyDetailsModel.branch);

                    var oPDFConditionModel = this.getView().getModel("PDFConditionModel").getData();

                    // --- Images ---
                    if (!oCompanyDetailsModel.companylogo64 &&
                        !oCompanyDetailsModel.signature64 &&
                        !oCompanyDetailsModel.backgroundLogoBase64 &&
                        !oCompanyDetailsModel.emailLogoBase64) {

                        try {
                            const logoBlob = new Blob([new Uint8Array(oCompanyDetailsModel.companylogo?.data)], { type: "image/png" });
                            const signBlob = new Blob([new Uint8Array(oCompanyDetailsModel.signature?.data)], { type: "image/png" });
                            const backgroundBlob = new Blob([new Uint8Array(oCompanyDetailsModel.backgroundLogo?.data)], { type: "image/png" });
                            const emailBlob = new Blob([new Uint8Array(oCompanyDetailsModel.emailLogo?.data)], { type: "image/png" });

                            const [logoBase64, signBase64, backgroundBase64, emailBase64] = await Promise.all([
                                this._convertBLOBToImage(logoBlob),
                                this._convertBLOBToImage(signBlob),
                                this._convertBLOBToImage(backgroundBlob),
                                this._convertBLOBToImage(emailBlob)
                            ]);

                            oCompanyDetailsModel.companylogo64 = logoBase64;
                            oCompanyDetailsModel.signature64 = signBase64;
                            oCompanyDetailsModel.backgroundLogoBase64 = backgroundBase64;
                            oCompanyDetailsModel.emailLogoBase64 = emailBase64;
                        } catch (err) {
                            console.error("Image compression failed:", err);
                        }
                    }
            
            // PDF Generation
            if (
                oCompanyDetailsModel.companylogo64 &&
                oCompanyDetailsModel.signature64 &&
                typeof EmpIPNCAPDF !== "undefined" &&
                typeof EmpIPNCAPDF._GeneratePDF === "function"
            ) {
                EmpIPNCAPDF._GeneratePDF(
                    this,
                    oPDFModel.getData(),
                    oCompanyDetailsModel,
                    oPDFConditionModel
                );
            }

        } catch (err) {
            sap.m.MessageToast.show(err.message || err.responseText);
        } finally {
            this.closeBusyDialog();
        }
    }
  });
});
