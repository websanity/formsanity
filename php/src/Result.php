<?php

declare(strict_types=1);

namespace WebSanity\FormSanity;

/** The outcome of validating a submission: the errors found, the envelope and HTTP status that report them, and the fields that were relevant. */
final class Result
{
	/**
	 * @param list<array{field: ?string, code: string, message: string}> $errors
	 * @param list<string> $relevant the names of the relevant fields, in document order
	 */
	public function __construct(private array $errors, private readonly array $relevant = [])
	{
	}

	public function isValid(): bool
	{
		return $this->errors === [];
	}

	/** @return list<array{field: ?string, code: string, message: string}> */
	public function errors(): array
	{
		return $this->errors;
	}

	/** Whether the submitted values made the named field relevant. A name the markup does not define is never relevant. */
	public function isRelevant(string $field): bool
	{
		return in_array($field, $this->relevant, true);
	}

	/** The names of the fields the submitted values made relevant, in document order. @return list<string> */
	public function relevantFields(): array
	{
		return $this->relevant;
	}

	public function withError(?string $field, string $code, string $message): self
	{
		$result = clone $this;
		$result->errors[] = ['field' => $field, 'code' => $code, 'message' => $message];

		return $result;
	}

	public function envelope(?string $message = null, ?string $redirect = null): array
	{
		if ($this->isValid()) {
			return Envelope::accepted($message, $redirect);
		}

		return Envelope::invalid($this->errors);
	}

	public function httpStatus(): int
	{
		return $this->isValid() ? 200 : 422;
	}
}
