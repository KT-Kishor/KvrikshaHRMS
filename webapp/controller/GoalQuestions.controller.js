sap.ui.define(
  [
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "../utils/validation",
  ],
  function (BaseController, JSONModel, MessageBox, MessageToast, utils) {
    "use strict";
    
    return BaseController.extend(
      "sap.kt.com.minihrsolution.controller.GoalQuestions",
      {
        onInit: function () {
         
          const oViewModel = new JSONModel({
            isEditMode: false,
            selectedDepartment: "",
          });
          this.getView().setModel(oViewModel, "viewModel");
          this.getRouter()
            .getRoute("RouteGoalQuestions")
            .attachPatternMatched(this.QD_onRouteMatched, this);
        },

        QD_onRouteMatched: async function () {
            var LoginFunction = await this.commonLoginFunction("GoalQuestions");
                if (!LoginFunction) return;
                 this.getBusyDialog();
                  const oView = this.getView();
                  const oLoginModel = oView.getModel("LoginModel");
      const oLoginData = oLoginModel.getData();
      this.oLoginModel = oLoginData;
          this.i18nModel = this.getOwnerComponent()
            .getModel("i18n")
            .getResourceBundle();
            this.byId("QD_id_Department").setSelectedKey("")
          
          if (!this._deptLoaded) {
            await this.QD_loadDepartmentData();
            this._deptLoaded = true;
          }
          const sFilterDepartment = this.getView()
            .getModel("viewModel")
            .getProperty("/selectedDepartment");
            oLoginModel.setProperty("/HeaderName", this.i18nModel.getText("QuestionsDetailsTitle"));
          await this.QD_loadQuestionsData(sFilterDepartment);
        },

        formatDepartmentName: function (sDeptId) {
          const aDept =
            this.getView().getModel("sEmployeeModel").getData() || [];
          const oMatch = aDept.find((item) => item.id == sDeptId);
          return oMatch ? oMatch.departmentName : sDeptId;
        },

        QD_loadDepartmentData: async function () {
          try {
            let Dept = [];
              const result = await this.ajaxReadWithJQuery("Designation");
              Dept = result?.data || result?.results || result || [];
                const uniqueDeptMap = new Map();

        Dept.forEach(item => {
            if (item.department) {
                uniqueDeptMap.set(item.department, item);
            }
        });

        const uniqueDepartments = Array.from(uniqueDeptMap.values());

        //  Set model
        const oDeptModel = new JSONModel(uniqueDepartments);

            // const oDeptModel = new JSONModel(Dept);
            this.getView().setModel(oDeptModel, "sEmployeeModel");
          } catch (error) {
            MessageToast.show(this.getText("loadDepartmentError"));
          }
        },

        // LOAD TABLE DATA (GET API)
        QD_loadQuestionsData: async function (sDepartment = "") {
          try {
            this.getBusyDialog();

            const sQuery = sDepartment
              ? "?Department=" + encodeURIComponent(sDepartment)
              : "";

            const result = await this.ajaxReadWithJQuery(
              "GoalQuestions",
              sQuery,
            );

            const aData = Array.isArray(result?.data)
              ? result.data
              : Array.isArray(result)
                ? result
                : [];

            this.getView().setModel(
              new JSONModel({ Questions: aData }),
              "Questionmodel",
            );

            this.byId("QD_id_Title").setText(
              this.getText("QuestionsList") + " (" + aData.length + ")",
            );
          } catch (err) {
            this.closeBusyDialog();
            MessageToast.show(this.getText("loadDataError"));
          } finally {
            this.closeBusyDialog();
          }
        },

        QD_getDialogControls: function () {
          const sViewId = this.getView().getId();

          return {
            dept: sap.ui.core.Fragment.byId(sViewId, "FQD_id_Department"),
            topic: sap.ui.core.Fragment.byId(sViewId, "FQD_id_Topic"),
            question: sap.ui.core.Fragment.byId(sViewId, "FQD_id_Question"),
          };
        },
        // FILTER
        QD_onGoPress: async function () {
          const oCombo = this.byId("QD_id_Department");
          const oSelectedItem = oCombo.getSelectedItem();

          const sDepartmentName = oSelectedItem ? oSelectedItem.getText() : "";

          // Store filter
          this.getView()
            .getModel("viewModel")
            .setProperty("/selectedDepartment", sDepartmentName);

          // Call reusable function
          await this.QD_loadQuestionsData(sDepartmentName);
        },

        // CREATE DIALOG
        QD_onCreatePress: async function () {
          const oViewModel = this.getView().getModel("viewModel");
          oViewModel.setProperty("/isEditMode", false);
          oViewModel.setProperty("/dialogTitle", this.getText("addQuestion"));

          if (!this.QD_oQuestionsDialog) {
            this.QD_oQuestionsDialog = await this.loadFragment({
              name: "sap.kt.com.minihrsolution.fragment.AddGoalQuestions",
            });
            this.getView().addDependent(this.QD_oQuestionsDialog);
          }

          // GET FRAGMENT CONTROLS PROPERLY
          const oDept = sap.ui.core.Fragment.byId(
            this.getView().getId(),
            "FQD_id_Department",
          );
          const oTopic = sap.ui.core.Fragment.byId(
            this.getView().getId(),
            "FQD_id_Topic",
          );
          const oQuestion = sap.ui.core.Fragment.byId(
            this.getView().getId(),
            "FQD_id_Question",
          );

          // CLEAR VALUES
          oDept.setSelectedKey("");
          oTopic.setValue("");
          oQuestion.setValue("");

          //  CLEAR VALUE STATES
          oDept.setValueState("None");
          oTopic.setValueState("None");
          oQuestion.setValueState("None");

          this.QD_clearTableSelection();

          this.QD_oQuestionsDialog.open();
        },

        // UPDATE DIALOG
        QD_onUpdatePress: async function () {
          const oViewModel = this.getView().getModel("viewModel");
          oViewModel.setProperty("/isEditMode", true);
          oViewModel.setProperty("/dialogTitle", this.getText("editQuestion"));

          const oTable = this.byId("QD_id_Table");
          const aSelectedItems = oTable.getSelectedItems();

          if (aSelectedItems.length !== 1) {
            MessageToast.show(this.getText("selctRowtoApprove"));
            return;
          }

          const oContext = aSelectedItems[0].getBindingContext("Questionmodel");
          const oRowData = oContext.getObject();

          this.QD_selectedRowData = oRowData;

          if (!this.QD_oQuestionsDialog) {
            this.QD_oQuestionsDialog = await this.loadFragment({
              name: "sap.kt.com.minihrsolution.fragment.AddGoalQuestions",
            });
            this.getView().addDependent(this.QD_oQuestionsDialog);
          }

          const oDept = sap.ui.core.Fragment.byId(
            this.getView().getId(),
            "FQD_id_Department",
          );
          const oTopic = sap.ui.core.Fragment.byId(
            this.getView().getId(),
            "FQD_id_Topic",
          );
          const oQuestion = sap.ui.core.Fragment.byId(
            this.getView().getId(),
            "FQD_id_Question",
          );

          oDept.setSelectedKey(oRowData.Department);
          oTopic.setValue(oRowData.Topic);
          oQuestion.setValue(oRowData.Question);

          oDept.setValueState("None");
          oTopic.setValueState("None");
          oQuestion.setValueState("None");

          this.QD_oQuestionsDialog.open();
          this.QD_clearTableSelection();
        },

        QD_validateDialog: function () {
          const { dept, topic, question } = this.QD_getDialogControls();

          return (
            utils._LCstrictValidationComboBox(dept, "ID") &&
            utils._LCvalidateMandatoryField(topic, "ID") &&
            utils._LCvalidateMandatoryField(question, "ID")
          );
        },
        
        FQD_onTopicChange: function (oEvent) {
          utils._LCvalidateMandatoryField(oEvent);
        },

        FQD_onDepartmentChange: function (oEvent) {
          utils._LCstrictValidationComboBox(oEvent);
        },
        FQD_onQuestionChange: function (oEvent) {
          utils._LCvalidateMandatoryField(oEvent);
        },

        FQD_onSaveDialogPress: async function () {
          if (
            utils._LCstrictValidationComboBox(
              this.byId("FQD_id_Department"),
              "ID",
            ) &&
            utils._LCvalidateMandatoryField(this.byId("FQD_id_Topic"), "ID") &&
            utils._LCvalidateMandatoryField(this.byId("FQD_id_Question"), "ID")
          )
            try {
              const { dept, topic, question } = this.QD_getDialogControls();
              this.getBusyDialog();

              const payload = {
                Department: dept.getSelectedItem()?.getText()?.trim(),
                Topic: topic.getValue().trim(),
                Question: question.getValue().trim(),
              };

              const bEditMode = this.getView()
                .getModel("viewModel")
                .getProperty("/isEditMode");

              if (bEditMode) {
                await this.ajaxUpdateWithJQuery("GoalQuestions", {
                  filters: this.QD_selectedRowData,
                  data: payload,
                });

                MessageToast.show(this.getText("updateSuccess"));
              } else {
                await this.ajaxCreateWithJQuery("GoalQuestions", {
                  data: payload,
                });

                MessageToast.show(this.getText("createSuccess"));
              }

              this.QD_oQuestionsDialog.close();
              await this.QD_loadQuestionsData(this.QD_getSelectedDepartment());
              this.QD_restoreDepartmentFilter();
            } catch (err) {
              console.error(err);
              MessageToast.show(this.getText("saveFailed"));
            } finally {
              this.closeBusyDialog();
            }
        },

        QD_onDeletePress: function () {
          const oTable = this.byId("QD_id_Table");
          const aSelectedItems = oTable.getSelectedItems();

          if (aSelectedItems.length === 0) {
            MessageToast.show(this.getText("selctRowtoApprove"));
            return;
          }

          MessageBox.confirm(this.getText("confirmDelete"), {
            actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],

            onClose: async function (sAction) {
              if (sAction === MessageBox.Action.CANCEL) {
                this.QD_clearTableSelection();
                return;
              }

              if (sAction !== MessageBox.Action.OK) return;

              try {
                this.getBusyDialog();

                //  DELETE using BaseController
                for (let item of aSelectedItems) {
                  const oData = item
                    .getBindingContext("Questionmodel")
                    .getObject();

                  await this.ajaxDeleteWithJQuery("GoalQuestions", {
                    filters: {
                      Department: oData.Department,
                      Topic: oData.Topic,
                      Question: oData.Question,
                    },
                  });
                }
                     this.closeBusyDialog();
                MessageToast.show(
                  this.getText("deleteSuccess", [aSelectedItems.length]),
                );

                const sFilterDepartment = this.QD_getSelectedDepartment();
                await this.QD_loadQuestionsData(sFilterDepartment);
                this.QD_restoreDepartmentFilter();

                // Update count
                const oBinding = this.byId("QD_id_Table").getBinding("items");
                const iCount = oBinding.getLength();

                this.byId("QD_id_Title").setText(
                  this.getText("QuestionsList") + " (" + iCount + ")",
                );

                setTimeout(() => {
                  this.QD_clearTableSelection();
                }, 0);
              } catch (err) {
                this.closeBusyDialog();
                MessageToast.show(this.getText("deleteFailed"));
              } finally {
                this.closeBusyDialog();
              }
            }.bind(this),
          });
        },

       QD_onCloseUploadDialog: function () {
    // Close dialog
    this.byId("QD_id_UploadDialog").close();

    // ✅ Clear FileUploader UI
    const oFileUploader = this.byId("QD_id_FileUploader");
    oFileUploader.clear();

    // ✅ Clear stored file reference
    this._selectedFile = null;
},

        QD_onDownloadExcelPress: function () {
          try {
            // Get data from model
            var aData =
              this.getView()
                .getModel("Questionmodel")
                .getProperty("/Questions") || [];

            // Prepare data for Excel
            var aFormattedData = aData.map(function (item) {
              return {
                Department: item.Department,
                "Topic": item.Topic,
                Question: item.Question,
              };
            });

            // Create worksheet
            var oWorksheet =
              aFormattedData.length > 0
                ? XLSX.utils.json_to_sheet(aFormattedData)
                : XLSX.utils.aoa_to_sheet([
                    ["Department", "Topic", "Question"],
                  ]);

            // Create workbook
            var oWorkbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(oWorkbook, oWorksheet, "Questions");

            // Download Excel file
            XLSX.writeFile(oWorkbook, "GoalQuestions_Data.xlsx");

            MessageToast.show(this.getText("downloadsuccessfully"));
          } catch (error) {
            console.error("Download Error:", error);
            MessageToast.show(this.getText("downloadFailed"));
          }
        },

        getText: function (sKey, aParams) {
          return this.getOwnerComponent()
            .getModel("i18n")
            .getResourceBundle()
            .getText(sKey, aParams);
        },
         QD_handleValueChange: function (oEvent) {
    const oFileUploader = this.byId("QD_id_FileUploader");
    const aFiles = oEvent.getParameter("files"); // ✅ correct way

    if (!aFiles || aFiles.length === 0) {
        sap.m.MessageToast.show(this.getText("fileRemoved"));
        this._selectedFile = null;
        return;
    }

    // ✅ store file globally in controller
    this._selectedFile = aFiles[0];

    oFileUploader.setValue(this._selectedFile.name);
},

QD_handleUploadPress: function () {

    this.QD_clearTableSelection();

    // ✅ Use stored file instead of DOM
    if (!this._selectedFile) {
        sap.m.MessageToast.show(this.getText("chooseFileFirst"));
        return;
    }

    const oFile = this._selectedFile;

   

    const reader = new FileReader();

    reader.onload = async function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: "array" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(sheet);

            if (!jsonData.length) {
                sap.m.MessageToast.show(this.getText("excelEmpty"));
                return;
            }

            const requiredFields = ["Department", "Topic", "Question"];
            const hasValidHeaders = requiredFields.every(field =>
                Object.keys(jsonData[0]).includes(field)
            );

            if (!hasValidHeaders) {
                sap.m.MessageBox.error(
                    "Invalid Excel format. Required columns: Department, Topic, Question"
                );
                return;
            }

            const formattedData = jsonData
                .map(item => ({
                    Department: (item.Department || "").toString().trim(),
                    Topic: (item.Topic || "").toString().trim(),
                    Question: (item.Question || "")
                        .toString()
                        .replace(/\n/g, "")
                        .replace(/\r/g, "")
                        .trim()
                }))
                .filter(item =>
                    item.Department && item.Topic && item.Question
                );

            if (!formattedData.length) {
                sap.m.MessageBox.error("No valid rows found in Excel");
                return;
            }

            const aExisting =
                this.getView()
                    .getModel("Questionmodel")
                    ?.getProperty("/Questions") || [];

            let duplicates = [];
            let unique = formattedData;

            try {
                const result = utils.validateDuplicateQuestions(
                    aExisting,
                    formattedData
                );
                duplicates = result.duplicates || [];
                unique = result.unique || [];
            } catch (e) {
                console.warn("Validation skipped:", e);
            }

            if (duplicates.length > 0) {
                sap.m.MessageBox.warning(
                    this.getText("duplicateRecords", [duplicates.length])
                );
            }

            let successCount = 0;
               this.getBusyDialog();
            for (let item of unique) {
                try {
                    await this.ajaxCreateWithJQuery("GoalQuestions", {
                        data: item
                    });
                    successCount++;
                } catch (apiErr) {
                    console.error("Insert failed:", item, apiErr);
                }
            }

            await this.QD_loadQuestionsData(this.QD_getSelectedDepartment());
            this.QD_restoreDepartmentFilter();

            sap.m.MessageToast.show(`Uploaded ${successCount} records successfully`);

            // ✅ Cleanup
            this._selectedFile = null;
            this.byId("QD_id_FileUploader").clear();
            this.byId("QD_id_UploadDialog").close();

        } catch (err) {
            console.error(err);
            this.closeBusyDialog()
            sap.m.MessageBox.error(err.message || this.getText("invalidExcel"));
        } finally {
            this.closeBusyDialog();
        }
    }.bind(this);

    reader.readAsArrayBuffer(oFile);
},

        QD_onUploadPress: function () {
          this.byId("QD_id_UploadDialog").open();
        },

      
        QD_onDepartmentFilterChange: function (oEvent) {
          const oCombo = oEvent.getSource();
          const sKey = oCombo.getSelectedKey();

          // If user clicks cross (X)
          if (!sKey) {
            // just clear UI
            oCombo.setValue("");
            oCombo.setSelectedKey("");

            // clear view model only
            this.getView()
              .getModel("viewModel")
              .setProperty("/selectedDepartment", "");

            //  DO NOT reload table
            return;
          }

          // If value selected â†’ just store it
          this.getView()
            .getModel("viewModel")
            .setProperty("/selectedDepartment", sKey);
        },

        QD_clearTableSelection: function () {
          const oTable = this.byId("QD_id_Table");
          if (oTable) {
            oTable.removeSelections(true); // true = suppress event
          }
        },
        QD_onClearPress: function () {
          // Get ComboBox
          const oCombo = this.byId("QD_id_Department");
          // Clear UI selection
          oCombo.setSelectedKey("");
          oCombo.setValue("");
          // Clear ViewModel filter value only
          this.getView()
            .getModel("viewModel")
            .setProperty("/selectedDepartment", "");
        },

        FQD_onCloseDialogPress: function () {
          this.QD_oQuestionsDialog.close();
          this.QD_clearTableSelection();
        },

        QD_getSelectedDepartment: function () {
          return (
            this.getView()
              .getModel("viewModel")
              .getProperty("/selectedDepartment") || ""
          );
        },

        QD_restoreDepartmentFilter: function () {
          const sDept = this.QD_getSelectedDepartment();
          const oCombo = this.byId("QD_id_Department");

          if (oCombo && sDept) {
            // Match by text OR key depending on your binding
            const aItems = oCombo.getItems();

            const oMatch = aItems.find((item) => item.getText() === sDept);

            if (oMatch) {
              oCombo.setSelectedKey(oMatch.getKey());
              oCombo.setValue(oMatch.getText());
            }
          }
        },
        QD_setQuestionsModel: function (aData) {
          const oModel = new JSONModel({
            Questions: aData || [],
          });

          this.getView().setModel(oModel, "Questionmodel");

          this.byId("QD_id_Title").setText(
            this.getText("QuestionsList") + " (" + aData.length + ")",
          );
        },

        onPressback: function () {
          this.getRouter().navTo("RouteTilePage");
          
        },
         onLogout() {
      this.getRouter().navTo("RouteLoginPage");
    },
      },
    );
  },
);