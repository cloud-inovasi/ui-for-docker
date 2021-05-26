export class EditEdgeStackFormController {
  /* @ngInject */
  constructor() {
    this.state = {
      hasKubeEndpoint: false,
    };

    this.onChangeGroups = this.onChangeGroups.bind(this);
    this.editorUpdate = this.editorUpdate.bind(this);
  }

  onChangeGroups(groups) {
    this.model.EdgeGroups = groups;

    this.checkIfHasKubeEndpoint(groups);
  }

  checkIfHasKubeEndpoint(groups) {
    if (!groups.length) {
      this.state.hasKubeEndpoint = false;
    }

    const edgeGroups = groups.map((id) => this.edgeGroups.find((e) => e.Id === id));
    const endpointTypes = edgeGroups.flatMap((group) => group.EndpointTypes);

    this.state.hasKubeEndpoint = endpointTypes.includes(7);
  }

  editorUpdate(cm) {
    if (this.model.StackFileContent.replace(/(\r\n|\n|\r)/gm, '') !== cm.getValue().replace(/(\r\n|\n|\r)/gm, '')) {
      this.model.StackFileContent = cm.getValue();
      this.isEditorDirty = true;
    }
  }

  $onInit() {
    this.checkIfHasKubeEndpoint(this.model.EdgeGroups);
  }
}
