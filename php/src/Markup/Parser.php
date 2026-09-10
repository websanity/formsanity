<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Markup;

use Dom\Element;
use Dom\HTMLDocument;
use WebSanity\FormSanity\AuthoringError;
use WebSanity\FormSanity\Expression\Compiled;
use WebSanity\FormSanity\Expression\Parser as ExpressionParser;
use WebSanity\FormSanity\Model\Control;
use WebSanity\FormSanity\Model\Field;
use WebSanity\FormSanity\Model\Form;
use WebSanity\FormSanity\Model\Group;
use WebSanity\FormSanity\Model\Region;
use WebSanity\FormSanity\Model\Rule;
use WebSanity\FormSanity\Types\Validator;
use WebSanity\FormSanity\Validation\Native;

/** Reads authored markup into the model a submission is judged against. Everything the vocabulary calls an authoring error is raised here, at parse time. */
final class Parser
{
	/** The elements that hold a value. Everything else that carries `data-fs-relevant` is a region, apart from an `option`. */
	private const array CONTROLS = ['input', 'select', 'textarea'];

	/** The native constraint attributes a control can carry, recorded as authored. */
	private const array NATIVE = ['required', 'minlength', 'maxlength', 'min', 'max', 'step', 'pattern', 'accept'];

	/** The two group attributes, mapped to the kind of group each names. */
	private const array GROUPS = [
		'data-fs-group-required-any' => 'required-any',
		'data-fs-group-required-together' => 'required-together',
	];

	/** The size grammar of `data-fs-max-file-size`: a number, an optional space, and a binary unit. */
	private const string SIZE = '/^[0-9]+(\.[0-9]+)?\s*(b|kb|mb|gb)$/i';

	public static function parse(string $html): Form
	{
		$document = HTMLDocument::createFromString($html, LIBXML_NOERROR);
		$form = $document->querySelector('[data-fs-form]');

		if ($form === null) {
			throw new AuthoringError('The document holds no element with data-fs-form.');
		}

		$regionElements = [];
		$regions = [];

		foreach ($form->querySelectorAll('[data-fs-relevant]') as $element) {
			if (in_array($element->localName, self::CONTROLS, true) || $element->localName === 'option') {
				continue;
			}

			$regionElements[] = $element;
			$regions[] = new Region(ExpressionParser::parse($element->getAttribute('data-fs-relevant') ?? ''));
		}

		$elementsByName = [];
		$hasFileInput = false;

		foreach ($form->querySelectorAll(implode(', ', self::CONTROLS)) as $element) {
			if (self::typeOf($element) === 'file') {
				$hasFileInput = true;
			}

			$name = $element->getAttribute('name');

			if ($name === null || $name === '') {
				continue;
			}

			$elementsByName[$name][] = $element;
		}

		$fields = [];
		$groups = [];

		foreach ($elementsByName as $name => $elements) {
			$fields[$name] = self::field((string) $name, $elements, $regionElements);
			self::collectGroups((string) $name, $elements, $groups);
		}

		return new Form($fields, $regions, array_values($groups), $hasFileInput);
	}

	/**
	 * A field is every control that shares one `name`. It is a set when it holds two or more controls and the first is a checkbox or a radio button.
	 *
	 * @param list<Element> $elements
	 * @param list<Element> $regionElements
	 */
	private static function field(string $name, array $elements, array $regionElements): Field
	{
		$first = $elements[0];
		$type = $first->getAttribute('data-fs-type');

		if ($type !== null && !Validator::isKnown($type)) {
			throw new AuthoringError(sprintf('Unknown data-fs-type "%s" on field "%s".', $type, $name));
		}

		$controls = array_map(static fn (Element $element): Control => self::control($element, $regionElements), $elements);
		$nativeRequired = false;

		foreach ($elements as $element) {
			$nativeRequired = $nativeRequired || $element->hasAttribute('required');
		}

		// Native `required` wins: a field that carries it never reads `data-fs-required`.
		$conditional = $nativeRequired ? null : self::setAttribute($elements, 'data-fs-required');

		return new Field(
			$name,
			$controls,
			count($elements) > 1 && in_array(self::typeOf($first), ['checkbox', 'radio'], true),
			$type,
			$first->getAttribute('data-fs-type-param'),
			self::rules($elements, $type),
			$conditional === null ? null : ExpressionParser::parse($conditional),
			$nativeRequired,
			$first->getAttribute('data-fs-unique'),
		);
	}

	/** @param list<Element> $regionElements */
	private static function control(Element $element, array $regionElements): Control
	{
		$native = [];

		foreach (self::NATIVE as $attribute) {
			if ($element->hasAttribute($attribute)) {
				$native[$attribute] = $element->getAttribute($attribute) ?? '';
			}
		}

		if (isset($native['pattern'])) {
			self::checkPattern($native['pattern']);
		}

		$regionIndexes = [];

		foreach ($regionElements as $index => $regionElement) {
			if ($regionElement->contains($element)) {
				$regionIndexes[] = $index;
			}
		}

		$options = [];

		foreach ($element->querySelectorAll('option') as $option) {
			$value = $option->hasAttribute('value') ? ($option->getAttribute('value') ?? '') : trim($option->textContent);
			$relevant = $option->getAttribute('data-fs-relevant');
			$options[$value] = $relevant === null ? null : ExpressionParser::parse($relevant);
		}

		$relevant = $element->getAttribute('data-fs-relevant');

		return new Control(
			$element->localName,
			self::typeOf($element),
			$element->hasAttribute('multiple'),
			$element->getAttribute('value') ?? '',
			$relevant === null ? null : ExpressionParser::parse($relevant),
			$regionIndexes,
			$options,
			$native,
		);
	}

	/**
	 * The rule attributes of a field. Every one is read from the first control, apart from the selection counts, which any member of a set may carry.
	 *
	 * @param list<Element> $elements
	 * @return list<Rule>
	 */
	private static function rules(array $elements, ?string $type): array
	{
		$first = $elements[0];
		$controlType = self::typeOf($first);
		$rules = [];

		$constraint = $first->getAttribute('data-fs-constraint');

		if ($constraint !== null) {
			// The expression compiles here so that a malformed one is an authoring error. The rule carries its source for the evaluator.
			ExpressionParser::parse($constraint);
			$rules[] = new Rule('constraint', $constraint, $first->getAttribute('data-fs-constraint-message'));
		}

		// A daily time window constrains the time-of-day component of a `datetime-local` control, and has no effect anywhere else.
		if ($controlType === 'datetime-local') {
			foreach (['min-time', 'max-time'] as $kind) {
				$rules = self::append($rules, $kind, $first->getAttribute('data-fs-' . $kind));
			}
		}

		foreach (['min-digits', 'min-uppercase', 'min-lowercase'] as $kind) {
			$rules = self::append($rules, $kind, $first->getAttribute('data-fs-' . $kind));
		}

		$rules = self::append($rules, 'group-unique-values', $first->getAttribute('data-fs-group-unique-values'));

		foreach (['min-selected', 'max-selected'] as $kind) {
			$rules = self::append($rules, $kind, self::setAttribute($elements, 'data-fs-' . $kind));
		}

		if ($first->hasAttribute('data-fs-max-file-size')) {
			$size = $first->getAttribute('data-fs-max-file-size') ?? '';

			if (preg_match(self::SIZE, trim($size)) !== 1) {
				throw new AuthoringError(sprintf('The size "%s" is not a number and a unit of b, kb, mb, or gb.', $size));
			}

			$rules[] = new Rule('max-file-size', $size);
		}

		// `accept` raises no native flag, so it is enforced as a rule of its own.
		if ($controlType === 'file') {
			$rules = self::append($rules, 'accept', $first->getAttribute('accept'));
		}

		// `data-fs-min` and `data-fs-max` are the twins of the native bounds, for the fs types that define an ordering of their own.
		if ($type !== null && Validator::isOrdered($type)) {
			$rules = self::append($rules, 'min-value', $first->getAttribute('data-fs-min'));
			$rules = self::append($rules, 'max-value', $first->getAttribute('data-fs-max'));
		}

		return $rules;
	}

	/**
	 * @param list<Rule> $rules
	 * @return list<Rule>
	 */
	private static function append(array $rules, string $kind, ?string $param): array
	{
		if ($param !== null) {
			$rules[] = new Rule($kind, $param);
		}

		return $rules;
	}

	/**
	 * @param list<Element> $elements
	 * @param array<string, Group> $groups
	 */
	private static function collectGroups(string $name, array $elements, array &$groups): void
	{
		foreach (self::GROUPS as $attribute => $kind) {
			$groupName = self::setAttribute($elements, $attribute);

			if ($groupName === null) {
				continue;
			}

			$key = $kind . ' ' . $groupName;
			$members = isset($groups[$key]) ? $groups[$key]->members : [];
			$members[] = $name;
			$groups[$key] = new Group($kind, $groupName, $members);
		}
	}

	/**
	 * An attribute that describes a whole set may sit on any member of it. The first member with the attribute wins.
	 *
	 * @param list<Element> $elements
	 */
	private static function setAttribute(array $elements, string $attribute): ?string
	{
		foreach ($elements as $element) {
			if ($element->hasAttribute($attribute)) {
				return $element->getAttribute($attribute) ?? '';
			}
		}

		return null;
	}

	/** The kind of value a control holds: the `type` attribute of an input, and the element itself for a select or a textarea. */
	private static function typeOf(Element $element): string
	{
		if ($element->localName === 'select') {
			return $element->hasAttribute('multiple') ? 'select-multiple' : 'select';
		}

		if ($element->localName === 'textarea') {
			return 'textarea';
		}

		$type = strtolower($element->getAttribute('type') ?? '');

		return $type === '' ? 'text' : $type;
	}

	/** HTML compiles a `pattern` in Unicode mode and matches it against the whole value. A pattern that does not compile is an authoring error, not a silent pass. */
	private static function checkPattern(string $pattern): void
	{
		// The register applies this same expression, so both read it from the one place that builds it.
		$expression = Native::patternExpression($pattern);

		set_error_handler(static fn (): bool => true);
		$compiles = preg_match($expression, '');
		restore_error_handler();

		if ($compiles === false) {
			throw new AuthoringError(sprintf('The pattern "%s" does not compile.', $pattern));
		}
	}
}
