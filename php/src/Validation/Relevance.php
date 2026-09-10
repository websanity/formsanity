<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Validation;

use WebSanity\FormSanity\Expression\Context;
use WebSanity\FormSanity\Model\Control;
use WebSanity\FormSanity\Model\Form;
use WebSanity\FormSanity\Payload\Upload;

/** Which controls and options of a form take part in a submission, settled from the submitted values, and the reader every expression of the form runs against. */
final class Relevance implements Context
{
	/** The passes the settling loop takes before it gives up. A model that does not settle within them has undefined behavior. */
	private const int PASSES = 10;

	/** How deep `valid()` may re-enter itself. A pair of fields that name each other stops here rather than recursing forever. */
	private const int DEPTH = 5;

	/** The control types whose value is the `value` attribute of the checked member. */
	private const array CHOICES = ['checkbox', 'radio'];

	/** A checkbox or a radio button with no `value` attribute submits this, per HTML. */
	private const string DEFAULT_MEMBER_VALUE = 'on';

	/** The relevance of each control of each field, keyed by name and by position in document order. @var array<string, array<int, bool>> */
	private array $controls = [];

	/** The relevance of each option each control declares, keyed by name, by control position, and by option value. @var array<string, array<int, array<array-key, bool>>> */
	private array $options = [];

	/** The relevance of each region of the form, in the order the parser recorded them. @var array<int, bool> */
	private array $regions = [];

	private int $depth = 0;

	/** @param array<string, string|list<string>|list<Upload>|mixed> $values the normalized submission */
	public function __construct(private readonly Form $form, private readonly array $values)
	{
		foreach ($this->form->fields as $name => $field) {
			foreach ($field->controls as $index => $control) {
				$this->controls[(string) $name][$index] = true;
				$this->options[(string) $name][$index] = array_map(static fn (): bool => true, $control->options);
			}
		}

		$this->regions = array_fill(0, count($this->form->regions), true);
		$this->settle();
	}

	public function isControlRelevant(string $field, int $index): bool
	{
		return $this->controls[$field][$index] ?? false;
	}

	/** A field is relevant while any one of its controls is. */
	public function isFieldRelevant(string $field): bool
	{
		return in_array(true, $this->controls[$field] ?? [], true);
	}

	public function isOptionRelevant(string $field, string $value): bool
	{
		foreach ($this->options[$field] ?? [] as $declared) {
			if (($declared[$value] ?? false) === true) {
				return true;
			}
		}

		return false;
	}

	/**
	 * The value of the field, read over its relevant members and relevant options only.
	 *
	 * @return string|list<string>|list<Upload>
	 */
	public function valueOf(string $field): mixed
	{
		// A name the markup does not define holds no answer, so an injected key cannot decide what an expression reads.
		if (!array_key_exists($field, $this->form->fields)) {
			return '';
		}

		$value = $this->values[$field] ?? '';

		if (!is_array($value)) {
			return is_string($value) ? $value : '';
		}

		$members = [];

		foreach ($value as $item) {
			// An upload belongs to a file field, which has one control and no member vocabulary to read it over.
			if ($item instanceof Upload) {
				$members[] = $item;
				continue;
			}

			if (is_string($item) && !$this->excludes($field, $item)) {
				$members[] = $item;
			}
		}

		return $members;
	}

	/** Whether the field declares this value on a member or on an option, and every declaration of it is irrelevant. */
	public function excludes(string $field, string $value): bool
	{
		$model = $this->form->fields[$field] ?? null;

		if ($model === null || $value === '') {
			return false;
		}

		$declared = false;

		foreach ($model->controls as $index => $control) {
			if ($control->options !== []) {
				if (array_key_exists($value, $control->options)) {
					$declared = true;

					if ($this->options[$field][$index][$value] ?? false) {
						return false;
					}
				}

				continue;
			}

			if (in_array($control->type, self::CHOICES, true) && self::memberValue($control) === $value) {
				$declared = true;

				if ($this->controls[$field][$index] ?? false) {
					return false;
				}
			}
		}

		return $declared;
	}

	/** Whether the value names no member of the field's choice group. A select is exempt, because a behavior can generate its options in the browser. */
	public function namesNoMember(string $field, string $value): bool
	{
		$model = $this->form->fields[$field] ?? null;

		if ($model === null || $value === '' || !in_array($model->controls[0]->type, self::CHOICES, true)) {
			return false;
		}

		foreach ($model->controls as $control) {
			if (self::memberValue($control) === $value) {
				return false;
			}
		}

		return true;
	}

	public function get(string $name): string
	{
		$value = $this->valueOf($name);

		if (is_string($value)) {
			return $value;
		}

		// A choice group and a multiple select read as their relevant answers, joined with commas in document order. A file field reads as the names of its uploads.
		return implode(',', array_map(static fn (mixed $item): string => $item instanceof Upload ? $item->name : (string) $item, $value));
	}

	public function typeOf(string $name): ?string
	{
		$field = $this->form->fields[$name] ?? null;

		if ($field === null) {
			return null;
		}

		$type = $field->controls[0]->type;

		return in_array($type, ['date', 'datetime-local', 'time'], true) ? $type : $field->type;
	}

	/** The named field passes its own validation: the native register, the type check, and its rules. */
	public function valid(string $name): bool
	{
		$field = $this->form->fields[$name] ?? null;

		if ($field === null || $this->depth >= self::DEPTH) {
			return false;
		}

		$this->depth++;

		try {
			return Validator::field($this->form, $field, $this) === null;
		} finally {
			$this->depth--;
		}
	}

	/** Evaluates every expression of the form against the submitted values, re-reads each set and each multiple select over its relevant members and options, and evaluates again until nothing changes. */
	private function settle(): void
	{
		for ($pass = 0; $pass < self::PASSES; $pass++) {
			$regions = [];

			foreach ($this->form->regions as $region) {
				$regions[] = $region->expr->evaluate($this);
			}

			$controls = [];
			$options = [];

			foreach ($this->form->fields as $name => $field) {
				$name = (string) $name;

				foreach ($field->controls as $index => $control) {
					$relevant = $control->relevant === null || $control->relevant->evaluate($this);

					// Relevance composes by conjunction: the control's own expression and the expression of every region that contains it.
					foreach ($control->regionIndexes as $region) {
						$relevant = $relevant && $regions[$region];
					}

					$declared = [];

					foreach ($control->options as $value => $expression) {
						$declared[$value] = $relevant && ($expression === null || $expression->evaluate($this));
					}

					// A select with options but no relevant one holds nothing to answer with, so it is an irrelevant control.
					$controls[$name][$index] = $relevant && ($declared === [] || in_array(true, $declared, true));
					$options[$name][$index] = $declared;
				}
			}

			if ($controls === $this->controls && $options === $this->options && $regions === $this->regions) {
				return;
			}

			$this->controls = $controls;
			$this->options = $options;
			$this->regions = $regions;
		}
	}

	private static function memberValue(Control $control): string
	{
		return $control->value === '' ? self::DEFAULT_MEMBER_VALUE : $control->value;
	}
}
