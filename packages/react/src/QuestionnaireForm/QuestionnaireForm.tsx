import { Title } from '@mantine/core';
import { ProfileResource, createReference, getReferenceString } from '@medplum/core';
import {
  Encounter,
  Questionnaire,
  QuestionnaireItem,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
  Reference,
} from '@medplum/fhirtypes';
import { useMedplum, useResource } from '@medplum/react-hooks';
import { useEffect, useState } from 'react';
import { Form } from '../Form/Form';
import { buildInitialResponse, getNumberOfPages, isQuestionEnabled } from '../utils/questionnaire';
import { QuestionnaireFormContext } from './QuestionnaireForm.context';
import { QuestionnairePageSequence } from './QuestionnaireFormComponents/QuestionnaireFormPageSequence';

export interface QuestionnaireFormProps {
  readonly questionnaire: Questionnaire | Reference<Questionnaire>;
  readonly subject?: Reference;
  readonly encounter?: Reference<Encounter>;
  readonly submitButtonText?: string;
  readonly onSubmit: (response: QuestionnaireResponse) => void;
  readonly getQFHIRResource?: (mappingRef: any) => void;
  readonly previewMode?: boolean;
}

export function QuestionnaireForm(props: QuestionnaireFormProps): JSX.Element | null {
  const medplum = useMedplum();
  const source = medplum.getProfile();
  const [schemaLoaded, setSchemaLoaded] = useState(false);
  const questionnaire = useResource(props.questionnaire);
  const [response, setResponse] = useState<QuestionnaireResponse | undefined>();
  const [activePage, setActivePage] = useState(0);

  useEffect(() => {
    medplum
      .requestSchema('Questionnaire')
      .then(() => medplum.requestSchema('QuestionnaireResponse'))
      .then(() => setSchemaLoaded(true))
      .catch(console.log);
  }, [medplum]);

  useEffect(() => {
    setResponse(questionnaire ? buildInitialResponse(questionnaire) : undefined);
  }, [questionnaire]);

  function setItems(newResponseItems: QuestionnaireResponseItem | QuestionnaireResponseItem[]): void {
    const currentItems = response?.item ?? [];
    const mergedItems = mergeItems(
      currentItems,
      Array.isArray(newResponseItems) ? newResponseItems : [newResponseItems]
    );

    const newResponse: QuestionnaireResponse = {
      resourceType: 'QuestionnaireResponse',
      status: 'in-progress',
      item: mergedItems,
    };

    setResponse(newResponse);
  }

  function checkForQuestionEnabled(item: QuestionnaireItem): boolean {
    return isQuestionEnabled(item, response?.item ?? []);
  }

  if (!schemaLoaded || !questionnaire) {
    return null;
  }

  const numberOfPages = getNumberOfPages(questionnaire);
  const nextStep = (): void => setActivePage((current) => current + 1);
  const prevStep = (): void => setActivePage((current) => current - 1);

  const getAnswerType = (type: string): string => {
    switch (type) {
      case 'boolean':
        return 'valueBoolean';
      case 'date':
        return 'valueDate';
      case 'string':
        return 'valueString';
      case 'decimal':
        return 'valueDecimal';
      case 'integer':
        return 'valueInteger';
      case 'url':
        return 'valueUrl';
      case 'dateTime':
        return 'valueDateTime';
      case 'referene':
        return 'valueReference';
      case 'quantity':
        return 'valueQuantity';
      case 'attachment':
        return 'valueAttachment';
      case 'text':
        return 'valueText';
    }
    return '';
  };

  const mapQResponseToFHIR = (QResponse: QuestionnaireResponse, mappingRef: any): any => {
    if (!QResponse?.item?.length) {
      return null;
    } else {
      for (const qResponseItem of QResponse.item) {
        if (qResponseItem.id?.includes('$')) {
          const [resourceName, itemType, itemKey] = qResponseItem.id.split('$');
          if (qResponseItem.answer?.length) {
            if (!(resourceName in mappingRef)) {
              mappingRef[resourceName] = {};
            }
            const currentAnswer: any = qResponseItem.answer?.[0];
            if (qResponseItem.text) {
              mappingRef[resourceName][itemKey] = currentAnswer?.[getAnswerType(itemType)];
            }
          }
        }
      }
    }

    return null;
  };

  return (
    <QuestionnaireFormContext.Provider value={{ subject: props.subject, encounter: props.encounter }}>
      <Form
        id={props.previewMode ? 'questionnaire-form-preview' : 'questionnaire-form'}
        testid="questionnaire-form"
        onSubmit={() => {
          if (!props.previewMode && props.onSubmit && response) {
            const questionnaireResponse: QuestionnaireResponse = {
              ...response,
              questionnaire: getReferenceString(questionnaire),
              subject: props.subject || {},
              source: source ? createReference(source as ProfileResource) : {},
              authored: new Date().toISOString(),
              status: 'completed',
            };
            if (props.getQFHIRResource) {
              const mappingRef: any = {};
              mapQResponseToFHIR(questionnaireResponse, mappingRef);
              props.getQFHIRResource(mappingRef);
            }
            props.onSubmit(questionnaireResponse);
          }
        }}
      >
        {questionnaire.title && <Title>{questionnaire.title}</Title>}
        <QuestionnairePageSequence
          items={questionnaire.item ?? []}
          response={response}
          onChange={setItems}
          renderPages={numberOfPages > 1}
          activePage={activePage}
          numberOfPages={numberOfPages}
          submitButtonText={props.submitButtonText}
          checkForQuestionEnabled={checkForQuestionEnabled}
          nextStep={nextStep}
          prevStep={prevStep}
        />
      </Form>
    </QuestionnaireFormContext.Provider>
  );
}

function mergeIndividualItems(
  prevItem: QuestionnaireResponseItem,
  newItem: QuestionnaireResponseItem
): QuestionnaireResponseItem {
  // Recursively merge the nested items based on their ids.
  const mergedNestedItems = mergeItems(prevItem.item ?? [], newItem.item ?? []);

  return {
    ...newItem,
    item: mergedNestedItems.length > 0 ? mergedNestedItems : undefined,
    answer: newItem.answer && newItem.answer.length > 0 ? newItem.answer : prevItem.answer,
  };
}

function mergeItems(
  prevItems: QuestionnaireResponseItem[],
  newItems: QuestionnaireResponseItem[]
): QuestionnaireResponseItem[] {
  const result: QuestionnaireResponseItem[] = [];
  const usedIds = new Set<string>();

  for (const prevItem of prevItems) {
    const itemId = prevItem.id;
    const newItem = newItems.find((item) => item.id === itemId);

    if (newItem) {
      result.push(mergeIndividualItems(prevItem, newItem));
      usedIds.add(newItem.id as string);
    } else {
      result.push(prevItem);
    }
  }

  // Add items from newItems that were not in prevItems.
  for (const newItem of newItems) {
    if (!usedIds.has(newItem.id as string)) {
      result.push(newItem);
    }
  }

  return result;
}
