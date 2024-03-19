import { Button, Grid, Modal, MultiSelect } from '@mantine/core';
import { CodeInput } from '../CodeInput/CodeInput';
import { useState } from 'react';
import { useMedplum } from '@medplum/react-hooks';
import { PropertyType, getPathDisplayName, tryGetDataType } from '@medplum/core';
import { DEFAULT_IGNORED_NON_NESTED_PROPERTIES, DEFAULT_IGNORED_PROPERTIES } from '../constants';
import { QuestionnaireItem } from '@medplum/fhirtypes';
import { QuestionnaireItemType } from '../utils/questionnaire';

export interface ResourceTableProps {
  readonly templateOpened: boolean;
  readonly closeTemplate: () => void;
  readonly generateId: () => void;
  readonly generateLinkId: (prefix: string) => string;
  readonly onModalSubmit: (questionnaireJSON: QuestionnaireItem[]) => void;
}

export function QuestionnaireResourceInput(props: ResourceTableProps): JSX.Element | null {
  const [resourceData, setResourceData] = useState<any>([
    {
      resourceName: '',
      fields: [],
      options: [],
    },
  ]);
  const CUSTOM_IGNORED_PROPERTIES = ['url', 'id', 'identifier', 'version', 'title', 'subtile'];
  const medplum = useMedplum();
  const [schemaLoaded, setSchemaLoaded] = useState(false);
  const onResourceNameChange = (newValue: string | undefined, index: number): void => {
    if (resourceData[index].resourceName !== newValue) {
      if (newValue) {
        medplum
          .requestSchema(newValue)
          .then(() => {
            resourceData[index].resourceName = newValue;
            const typeSchema = tryGetDataType(newValue);
            if (!typeSchema) {
              console.log(newValue + 'not implemented');
            } else {
              const filteredKeys: any[] = [];
              Object?.entries?.(typeSchema?.elements).filter((entry: any) => {
                const [key, property] = entry;
                if (DEFAULT_IGNORED_PROPERTIES.includes(key)) {
                  return false;
                }
                if (CUSTOM_IGNORED_PROPERTIES.includes(key)) {
                  return false;
                }
                if (DEFAULT_IGNORED_NON_NESTED_PROPERTIES.includes(key) && property.path.split('.').length === 2) {
                  return false;
                } else {
                  filteredKeys.push(key);
                  return true;
                }
              });
              resourceData[index].options = filteredKeys;
            }
            setSchemaLoaded(true);
            setResourceData([...resourceData]);
          })
          .catch(console.log);
      } else {
        resourceData[index].resourceName = newValue;
        resourceData[index].fields = [];
        resourceData[index].options = [];
        setResourceData([...resourceData]);
      }
    }
  };
  const onResourceFieldsChange = (newValue: string | undefined, index: number): void => {
    resourceData[index].fields = newValue;
    setResourceData([...resourceData]);
  };

  const onModalSubmit = (): void => {
    const currentResource = resourceData?.[0];
    if (currentResource?.resourceName && currentResource?.fields?.length) {
      const typeSchema = tryGetDataType(currentResource?.resourceName);
      if (!typeSchema) {
        console.log(currentResource?.resourceName + 'not implemented');
      } else {
        const questionnaireJSON: any[] = [];
        const genereateQuestionnaireItem = (type: string, item: any, text: string, key: string): void => {
          questionnaireJSON.push({
            id: currentResource?.resourceName + '$' + type + '$' + key + '$' + props.generateId(),
            linkId: props.generateLinkId('q'),
            type,
            text,
          });
        };

        currentResource?.fields?.forEach((key: string) => {
          const currentItem = typeSchema?.elements[key];
          const currentTypeProperty = typeSchema?.elements[key]?.type;
          const currentType = currentTypeProperty?.[0]?.code;
          const currentLabel = getPathDisplayName(key);
          switch (currentType) {
            case PropertyType.boolean:
              genereateQuestionnaireItem(QuestionnaireItemType.boolean, currentItem, currentLabel, key);
              break;
            case PropertyType.SystemString:
            case PropertyType.string:
            case PropertyType.Annotation:
              genereateQuestionnaireItem(QuestionnaireItemType.string, currentItem, currentLabel, key);
              break;
            case PropertyType.code:
              break;
            case PropertyType.date:
              genereateQuestionnaireItem(QuestionnaireItemType.date, currentItem, currentLabel, key);
              break;
            case PropertyType.decimal:
              genereateQuestionnaireItem(QuestionnaireItemType.decimal, currentItem, currentLabel, key);
              break;
            case PropertyType.Money:
            case PropertyType.integer:
            case PropertyType.positiveInt:
            case PropertyType.unsignedInt:
              genereateQuestionnaireItem(QuestionnaireItemType.integer, currentItem, currentLabel, key);
              break;
            case PropertyType.uri:
            case PropertyType.url:
              genereateQuestionnaireItem(QuestionnaireItemType.url, currentItem, currentLabel, key);
              break;
            case PropertyType.canonical:
              break;
            case PropertyType.dateTime:
            case PropertyType.instant:
              genereateQuestionnaireItem(QuestionnaireItemType.dateTime, currentItem, currentLabel, key);
              break;
            case PropertyType.markdown:
              // https://build.fhir.org/ig/HL7/sdc/examples.html#using-rendering-xhtml
              break;
            case PropertyType.Attachment:
              genereateQuestionnaireItem(QuestionnaireItemType.attachment, currentItem, currentLabel, key);
              break;
            case PropertyType.Address:
              break;
            case PropertyType.CodeableConcept:
              break;
            case PropertyType.Coding:
              break;
            case PropertyType.ContactDetail:
              break;
            case PropertyType.ContactPoint:
              break;
            case PropertyType.HumanName:
              break;
            case PropertyType.Identifier:
              break;
            case PropertyType.Period:
              break;
            case PropertyType.Quantity:
              genereateQuestionnaireItem(QuestionnaireItemType.quantity, currentItem, currentLabel, key);
              break;
            case PropertyType.Duration:
              break;
            case PropertyType.Range:
              break;
            case PropertyType.Ratio:
              break;
            case PropertyType.Reference:
              genereateQuestionnaireItem(QuestionnaireItemType.reference, currentItem, currentLabel, key);
              break;
            case PropertyType.Timing:
              break;
            case PropertyType.Dosage:
            case PropertyType.UsageContext:
              break;
            default:
              break;
          }
        });
        props.onModalSubmit(questionnaireJSON);
        console.log(questionnaireJSON);
      }
    }
  };

  return (
    // <BackboneElementDisplay
    //   value={{
    //     type: value.resourceType,
    //     value: props.forceUseInput ? props.value : value,
    //   }}
    //   ignoreMissingValues={props.ignoreMissingValues}
    // />
    <Modal
      centered
      opened={props.templateOpened}
      onClose={props.closeTemplate}
      title="Choose Template"
      id="chooseTemplate"
      size="xl"
    >
      <Grid my="sm">
        {resourceData?.map((resourceItem: any, index: number) => (
          <>
            <Grid.Col span={4} mr={1}>
              <CodeInput
                placeholder="Resource Type"
                binding="https://medplum.com/fhir/ValueSet/resource-types"
                creatable={false}
                defaultValue={resourceItem.resourceName}
                maxValues={1}
                clearable={false}
                onChange={(newResourceType: string | undefined) => onResourceNameChange(newResourceType, index)}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <MultiSelect
                disabled={Boolean(!resourceItem.resourceName) || !schemaLoaded}
                placeholder="Choose Fields"
                value={resourceItem.fields}
                data={resourceItem.options}
                clearable
                searchable
                hidePickedOptions
                onChange={(newValue: any) => onResourceFieldsChange(newValue, index)}
              />
            </Grid.Col>
          </>
        ))}
      </Grid>
      <Button mb="xs" mt="lg" type="submit" onClick={onModalSubmit}>
        Save
      </Button>
    </Modal>
  );
}
